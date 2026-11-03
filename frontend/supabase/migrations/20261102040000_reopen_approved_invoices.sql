begin;

create function public.reopen_invoice_for_correction(p_invoice_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  current_invoice public.invoices%rowtype;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Enter a reason of up to 500 characters';
  end if;
  select * into current_invoice from public.invoices
  where id = p_invoice_id and deleted_at is null for update;
  if not found or current_invoice.status <> 'approved' then
    raise exception 'Only approved invoices can be reopened';
  end if;
  if nullif(btrim(current_invoice.payment_confirmation_number), '') is not null then
    raise exception 'An invoice with a payment confirmation cannot be reopened';
  end if;
  update public.invoices set status = 'waiting on approval' where id = p_invoice_id;

  -- The existing row trigger created this status event in the same transaction.
  -- The invoice lock prevents another transition from interleaving here.
  update public.audit_events set reason = btrim(p_reason)
  where id = (
    select id from public.audit_events
    where invoice_id = p_invoice_id and action = 'updated'
      and actor_user_id = auth.uid()
      and changes -> 'status' ->> 'old' = 'approved'
      and changes -> 'status' ->> 'new' = 'waiting on approval'
    order by occurred_at desc, id desc limit 1
  );
  if not found then raise exception 'Could not record the reopening reason'; end if;
end;
$$;
revoke all on function public.reopen_invoice_for_correction(uuid, text) from public, anon, authenticated;
grant execute on function public.reopen_invoice_for_correction(uuid, text) to authenticated;

commit;
