begin;

-- Durable reservations survive navigation, concurrent clicks and lost HTTP responses.
create table public.invoice_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  run_id uuid unique,
  status text not null default 'starting' check (status in ('starting', 'running', 'succeeded', 'failed', 'uncertain')),
  expected jsonb not null,
  result jsonb,
  message text not null default 'Starting demo payment…',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index invoice_payment_attempts_active_idx on public.invoice_payment_attempts(invoice_id)
  where status in ('starting', 'running', 'uncertain', 'succeeded');
create index invoice_payment_attempts_invoice_idx on public.invoice_payment_attempts(invoice_id, created_at desc);
alter table public.invoice_payment_attempts enable row level security;
revoke all on public.invoice_payment_attempts from public, anon, authenticated;
grant select on public.invoice_payment_attempts to authenticated;
create policy "Signed-in users can read payment attempts" on public.invoice_payment_attempts
  for select to authenticated using (true);

create function public.begin_invoice_payment(p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  bill public.invoices%rowtype;
  vendor public.vendors%rowtype;
  attempt public.invoice_payment_attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into bill from public.invoices where id = p_invoice_id and deleted_at is null for update;
  if not found or bill.status <> 'approved' or nullif(btrim(bill.payment_confirmation_number), '') is not null then
    raise exception 'Only approved, unpaid invoices can start a payment';
  end if;
  select * into attempt from public.invoice_payment_attempts
    where invoice_id = bill.id and status <> 'failed' order by created_at desc limit 1;
  if found then return jsonb_build_object('claimed', false, 'attempt', to_jsonb(attempt)); end if;
  select * into vendor from public.vendors where id = bill.vendor_id and deleted_at is null for share;
  if not found or nullif(btrim(vendor.account_number), '') is null then
    raise exception 'An active vendor with an account number is required';
  end if;
  -- These are the fictional cohort sites. No real payment portals are enabled.
  if bill.payment_url is null or bill.payment_url !~ '^https://(alder-creek|brightwater|cedar-valley|copper-ridge|harborlight|maple-junction|northline|prairie-grid|summit-trail|sunmeadow)-utility-demo\.vercel\.app([/?#]|$)' then
    raise exception 'Choose one of the configured demo payment websites';
  end if;
  insert into public.invoice_payment_attempts(invoice_id, actor_user_id, expected)
  values (bill.id, auth.uid(), jsonb_build_object(
    'payment_url', bill.payment_url, 'account_number', btrim(vendor.account_number),
    'invoice_number', bill.reference_number, 'amount', bill.amount::text, 'currency', 'USD'
  )) returning * into attempt;
  return jsonb_build_object('claimed', true, 'attempt', to_jsonb(attempt));
end;
$$;

create function public.attach_invoice_payment_run(p_attempt_id uuid, p_run_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare bill_id uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select invoice_id into bill_id from public.invoice_payment_attempts where id = p_attempt_id;
  perform 1 from public.invoices where id = bill_id for update;
  update public.invoice_payment_attempts set run_id = p_run_id, status = 'running',
    message = 'Demo payment in progress…', updated_at = clock_timestamp()
    where id = p_attempt_id and run_id is null and status in ('starting', 'uncertain');
  if not found then raise exception 'Payment attempt is no longer waiting for a task ID'; end if;
end;
$$;

-- Prevent correction/archive/manual payment while external payment is unresolved.
create function app_private.protect_pending_invoice_payment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new is distinct from old and exists (
    select 1 from public.invoice_payment_attempts where invoice_id = old.id
      and status in ('starting', 'running', 'uncertain')
  ) then raise exception 'Resolve the current demo payment before changing this invoice'; end if;
  return new;
end;
$$;
create trigger protect_pending_invoice_payment before update on public.invoices
  for each row execute function app_private.protect_pending_invoice_payment();
revoke all on function app_private.protect_pending_invoice_payment() from public, anon, authenticated;

create function public.finish_invoice_payment(p_attempt_id uuid, p_status text, p_result jsonb, p_message text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  attempt public.invoice_payment_attempts%rowtype;
  bill_id uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_status is null or p_status not in ('succeeded', 'failed', 'uncertain') then raise exception 'Invalid payment outcome'; end if;
  select invoice_id into bill_id from public.invoice_payment_attempts where id = p_attempt_id;
  -- Consistent lock order, shared with reservation, reopening and confirmation.
  perform 1 from public.invoices where id = bill_id for update;
  select * into attempt from public.invoice_payment_attempts where id = p_attempt_id for update;
  if not found then raise exception 'Payment attempt not found'; end if;
  if attempt.status in ('succeeded', 'failed') then return; end if;
  if p_status = 'succeeded' then
    if p_result is null or not coalesce(
      p_result ->> 'outcome' = 'succeeded'
      and length(btrim(p_result ->> 'confirmation_number')) between 1 and 200
      and p_result ->> 'account_number' = attempt.expected ->> 'account_number'
      and p_result ->> 'invoice_number' = attempt.expected ->> 'invoice_number'
      and p_result ->> 'currency' = 'USD'
      and p_result ->> 'amount' ~ '^\d{1,10}(\.\d{1,2})?$', false
    ) then raise exception 'Payment result does not match the invoice'; end if;
    if (p_result ->> 'amount')::numeric <> (attempt.expected ->> 'amount')::numeric then
      raise exception 'Payment amount does not match the invoice';
    end if;
  end if;
  update public.invoice_payment_attempts set status = p_status, result = p_result,
    message = left(coalesce(p_message, ''), 1000), updated_at = clock_timestamp() where id = attempt.id;
  if p_status = 'succeeded' then
    -- Same confirmation operation as manual payment; audit and paid status are atomic.
    perform public.save_invoice_payment_confirmation(attempt.invoice_id, p_result ->> 'confirmation_number');
  end if;
end;
$$;

-- An uncertain attempt is never automatically retried. A person must first check
-- Browser Use and the site's history. This action releases it only after review.
create function public.resolve_invoice_payment(p_attempt_id uuid, p_confirmation text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  attempt public.invoice_payment_attempts%rowtype;
  bill_id uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if nullif(btrim(p_reason), '') is null or length(p_reason) > 500 then raise exception 'Enter a review note of up to 500 characters'; end if;
  if length(btrim(coalesce(p_confirmation, ''))) > 200 then raise exception 'Confirmation is too long'; end if;
  select invoice_id into bill_id from public.invoice_payment_attempts where id = p_attempt_id;
  perform 1 from public.invoices where id = bill_id for update;
  select * into attempt from public.invoice_payment_attempts where id = p_attempt_id for update;
  if not found or attempt.status <> 'uncertain' then raise exception 'Only uncertain payments can be resolved'; end if;
  update public.invoice_payment_attempts set
    status = case when nullif(btrim(p_confirmation), '') is null then 'failed' else 'succeeded' end,
    message = 'Reviewed: ' || btrim(p_reason), reviewed_by = auth.uid(), updated_at = clock_timestamp() where id = attempt.id;
  if nullif(btrim(p_confirmation), '') is not null then
    perform public.save_invoice_payment_confirmation(attempt.invoice_id, p_confirmation);
  end if;
end;
$$;

revoke all on function public.begin_invoice_payment(uuid) from public, anon, authenticated;
revoke all on function public.attach_invoice_payment_run(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_invoice_payment(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.resolve_invoice_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.begin_invoice_payment(uuid) to authenticated;
grant execute on function public.attach_invoice_payment_run(uuid, uuid) to authenticated;
grant execute on function public.finish_invoice_payment(uuid, text, jsonb, text) to authenticated;
grant execute on function public.resolve_invoice_payment(uuid, text, text) to authenticated;

commit;
