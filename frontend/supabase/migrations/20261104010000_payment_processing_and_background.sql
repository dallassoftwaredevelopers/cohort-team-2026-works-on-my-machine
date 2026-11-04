begin;

alter table public.invoices drop constraint invoices_status_check;
alter table public.invoices add constraint invoices_status_check check (
  status in ('created', 'waiting on approval', 'approved', 'payment processing', 'paid')
);

create or replace function app_private.protect_approved_invoice_fields()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status in ('approved', 'payment processing', 'paid') and (
    new.date, new.reference_number, new.vendor_id, new.property_id, new.amount, new.due_date, new.payment_url
  ) is distinct from (
    old.date, old.reference_number, old.vendor_id, old.property_id, old.amount, old.due_date, old.payment_url
  ) then raise exception 'An approved, processing or paid invoice cannot be edited'; end if;
  return new;
end;
$$;

create or replace function public.begin_invoice_payment(p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  bill public.invoices%rowtype;
  vendor public.vendors%rowtype;
  attempt public.invoice_payment_attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into bill from public.invoices where id = p_invoice_id and deleted_at is null for update;
  if not found or bill.status not in ('approved', 'payment processing') or nullif(btrim(bill.payment_confirmation_number), '') is not null then
    raise exception 'Only approved, unpaid invoices can start a payment';
  end if;
  select * into attempt from public.invoice_payment_attempts
    where invoice_id = bill.id and status <> 'failed' order by created_at desc limit 1;
  if found then return jsonb_build_object('claimed', false, 'attempt', to_jsonb(attempt)); end if;
  if bill.status <> 'approved' then raise exception 'Resolve the current payment before starting another'; end if;
  select * into vendor from public.vendors where id = bill.vendor_id and deleted_at is null for share;
  if not found or nullif(btrim(vendor.account_number), '') is null then
    raise exception 'An active vendor with an account number is required';
  end if;
  if bill.payment_url is null or bill.payment_url !~ '^https://(alder-creek|brightwater|cedar-valley|copper-ridge|harborlight|maple-junction|northline|prairie-grid|summit-trail|sunmeadow)-utility-demo\.vercel\.app([/?#]|$)' then
    raise exception 'Choose one of the configured demo payment websites';
  end if;
  -- Change status before inserting the reservation; the pending-payment trigger
  -- then protects all changes until settlement. Both writes commit together.
  update public.invoices set status = 'payment processing' where id = bill.id;
  insert into public.invoice_payment_attempts(invoice_id, actor_user_id, expected)
  values (bill.id, auth.uid(), jsonb_build_object(
    'payment_url', bill.payment_url, 'account_number', btrim(vendor.account_number),
    'invoice_number', bill.reference_number, 'amount', bill.amount::text, 'currency', 'USD'
  )) returning * into attempt;
  return jsonb_build_object('claimed', true, 'attempt', to_jsonb(attempt));
end;
$$;

create or replace function public.save_invoice_payment_confirmation(p_invoice_id uuid, p_confirmation text)
returns void language plpgsql security definer set search_path = ''
as $$
declare bill public.invoices%rowtype;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_confirmation is null or length(btrim(p_confirmation)) not between 1 and 200 then
    raise exception 'Enter a confirmation number of up to 200 characters';
  end if;
  select * into bill from public.invoices where id = p_invoice_id and deleted_at is null for update;
  if not found then raise exception 'Invoice not found'; end if;
  if bill.status = 'paid' and bill.payment_confirmation_number = btrim(p_confirmation) then return; end if;
  if bill.status not in ('approved', 'payment processing') then raise exception 'Only approved or processing invoices can be marked paid'; end if;
  update public.invoices set payment_confirmation_number = btrim(p_confirmation), status = 'paid' where id = bill.id;
end;
$$;

-- Keep the existing receipt validation/transaction as the canonical operation.
alter function public.finish_invoice_payment(uuid, text, jsonb, text) rename to finish_invoice_payment_result;
revoke all on function public.finish_invoice_payment_result(uuid, text, jsonb, text) from public, anon, authenticated;
alter function public.resolve_invoice_payment(uuid, text, text) rename to resolve_invoice_payment_result;
revoke all on function public.resolve_invoice_payment_result(uuid, text, text) from public, anon, authenticated;

create function public.finish_invoice_payment(p_attempt_id uuid, p_status text, p_result jsonb, p_message text)
returns void language plpgsql security definer set search_path = ''
as $$
declare bill_id uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select invoice_id into bill_id from public.invoice_payment_attempts where id = p_attempt_id;
  perform 1 from public.invoices where id = bill_id for update;
  perform public.finish_invoice_payment_result(p_attempt_id, p_status, p_result, p_message);
  -- Failure means the provider explicitly reports no submission. Uncertain
  -- outcomes keep their processing status and reservation until human review.
  if exists (select 1 from public.invoice_payment_attempts where id = p_attempt_id and status = 'failed') then
    update public.invoices set status = 'approved' where id = bill_id and status = 'payment processing';
  end if;
end;
$$;

create function public.resolve_invoice_payment(p_attempt_id uuid, p_confirmation text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare bill_id uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select invoice_id into bill_id from public.invoice_payment_attempts where id = p_attempt_id;
  perform 1 from public.invoices where id = bill_id for update;
  perform public.resolve_invoice_payment_result(p_attempt_id, p_confirmation, p_reason);
  if exists (select 1 from public.invoice_payment_attempts where id = p_attempt_id and status = 'failed') then
    update public.invoices set status = 'approved' where id = bill_id and status = 'payment processing';
  end if;
end;
$$;

-- The worker has no browser session. A service-role-only entry point restores
-- the initiating actor for the existing audit trigger and authenticated RPC.
create function public.finish_invoice_payment_in_background(p_attempt_id uuid, p_status text, p_result jsonb, p_message text)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Unauthorized'; end if;
  select actor_user_id into actor_id from public.invoice_payment_attempts where id = p_attempt_id;
  if not found then raise exception 'Payment attempt not found'; end if;
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config('request.jwt.claims', (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    || jsonb_build_object('sub', actor_id::text))::text, true);
  perform public.finish_invoice_payment(p_attempt_id, p_status, p_result, p_message);
end;
$$;

revoke all on function public.finish_invoice_payment(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.resolve_invoice_payment(uuid, text, text) from public, anon, authenticated;
revoke all on function public.finish_invoice_payment_in_background(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.finish_invoice_payment(uuid, text, jsonb, text) to authenticated;
grant execute on function public.resolve_invoice_payment(uuid, text, text) to authenticated;
grant execute on function public.finish_invoice_payment_in_background(uuid, text, jsonb, text) to service_role;
grant select on public.invoice_payment_attempts to service_role;

-- Upgrade any outstanding attempts from the first increment without launching
-- new tasks. Disable only the pending guard for this atomic status backfill.
alter table public.invoices disable trigger protect_pending_invoice_payment;
update public.invoices i set status = 'payment processing'
where status = 'approved' and exists (
  select 1 from public.invoice_payment_attempts p where p.invoice_id = i.id and p.status in ('starting', 'running', 'uncertain')
);
alter table public.invoices enable trigger protect_pending_invoice_payment;

commit;
