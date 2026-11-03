begin;

-- Paid invoices are retained as immutable records, including their attachments.
create function app_private.protect_paid_invoices()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status = 'paid' and new is distinct from old then
    raise exception 'Paid invoices are read-only';
  end if;
  if new.status = 'paid' and old.status <> 'paid'
    and nullif(btrim(new.payment_confirmation_number), '') is null then
    raise exception 'A payment confirmation number is required to mark an invoice paid';
  end if;
  return new;
end;
$$;
revoke all on function app_private.protect_paid_invoices() from public, anon, authenticated;
create trigger protect_paid_invoices before update on public.invoices
  for each row execute function app_private.protect_paid_invoices();

create or replace function public.save_invoice_payment_confirmation(p_invoice_id uuid, p_confirmation text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  invoice public.invoices%rowtype;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_confirmation is null or length(btrim(p_confirmation)) not between 1 and 200 then
    raise exception 'Enter a confirmation number of up to 200 characters';
  end if;
  select * into invoice from public.invoices
  where id = p_invoice_id and deleted_at is null for update;
  if not found then raise exception 'Invoice not found'; end if;
  -- A retry after a lost response succeeds without modifying the paid record.
  if invoice.status = 'paid' and invoice.payment_confirmation_number = btrim(p_confirmation) then return; end if;
  if invoice.status <> 'approved' then raise exception 'Only approved invoices can be marked paid'; end if;
  update public.invoices set payment_confirmation_number = btrim(p_confirmation), status = 'paid'
  where id = p_invoice_id;
end;
$$;
revoke all on function public.save_invoice_payment_confirmation(uuid, text) from public, anon, authenticated;
grant execute on function public.save_invoice_payment_confirmation(uuid, text) to authenticated;

-- Honor confirmations saved before this workflow was added; preserve old paid
-- test invoices that do not have a confirmation number.
update public.invoices set status = 'paid'
where status = 'approved' and deleted_at is null
  and nullif(btrim(payment_confirmation_number), '') is not null;

commit;
