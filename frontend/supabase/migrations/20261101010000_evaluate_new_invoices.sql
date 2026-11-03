-- New invoices are evaluated once, at intake. Existing invoices are unchanged.
-- All signed-in users may enter invoices, but status changes go through these
-- functions so the form and direct PostgREST requests follow the same rules.
begin;

-- The settings table is already deployed. Update its policy here rather than
-- rewriting the applied settings migration for the shared-role workflow.
drop policy "Admins can update approval rule settings" on public.approval_rule_settings;
create policy "Signed-in users can update approval rule settings"
  on public.approval_rule_settings for update to authenticated
  using (true) with check (true);

create table public.invoice_rule_evaluations (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  evaluated_at timestamptz not null default clock_timestamp(),
  outcome text not null check (outcome in ('approved', 'waiting on approval')),
  reasons text[] not null default '{}',
  evaluated_amount numeric(12, 2) not null,
  evaluated_date date not null,
  evaluated_vendor_id uuid not null,
  evaluated_property_id uuid not null,
  autopay boolean not null,
  max_auto_approval_amount numeric(12, 2),
  max_above_average_percent numeric(7, 2),
  min_comparable_bills integer,
  comparable_count bigint not null,
  comparable_average numeric(12, 2)
);

create index invoice_rule_evaluations_invoice_timeline_idx
  on public.invoice_rule_evaluations (invoice_id, evaluated_at desc);

alter table public.invoice_rule_evaluations enable row level security;
revoke all on table public.invoice_rule_evaluations from public, anon, authenticated;
grant select on table public.invoice_rule_evaluations to authenticated;
create policy "Signed-in users can read invoice rule evaluations"
  on public.invoice_rule_evaluations for select to authenticated using (true);

-- The earlier table grant allowed authenticated users to write any status.
-- New rows must enter through the rule function. Draft fields remain editable;
-- only the dedicated functions may set status.
revoke insert, update on table public.invoices from authenticated;
grant update (reference_number, vendor_id, property_id, due_date, amount, payment_url, deleted_at, deleted_by)
  on public.invoices to authenticated;

create function app_private.protect_approved_invoice_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('approved', 'paid') and (
    new.date, new.reference_number, new.vendor_id, new.property_id,
    new.amount, new.due_date, new.payment_url
  ) is distinct from (
    old.date, old.reference_number, old.vendor_id, old.property_id,
    old.amount, old.due_date, old.payment_url
  ) then
    raise exception 'An approved or paid invoice cannot be edited without reopening it';
  end if;
  return new;
end;
$$;

revoke all on function app_private.protect_approved_invoice_fields() from public, anon, authenticated;
create trigger protect_approved_invoice_fields
  before update on public.invoices
  for each row execute function app_private.protect_approved_invoice_fields();

create function public.create_invoice_with_rules(
  p_date date,
  p_reference_number text,
  p_vendor_id uuid,
  p_property_id uuid,
  p_amount numeric,
  p_due_date date,
  p_payment_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  vendor_autopay boolean;
  settings public.approval_rule_settings%rowtype;
  history_count bigint;
  history_average numeric;
  reasons text[] := '{}';
  decision text;
  new_invoice_id uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_date is null or p_due_date is null or p_amount is null or p_amount <= 0
    or p_amount > 9999999999.99 or p_amount <> round(p_amount, 2)
    or p_reference_number is null or btrim(p_reference_number) = ''
    or p_vendor_id is null or p_property_id is null then
    raise exception 'Invalid invoice details';
  end if;
  if p_payment_url is not null and p_payment_url !~* '^https?://' then
    raise exception 'Invalid payment URL';
  end if;

  select autopay into vendor_autopay
  from public.vendors where id = p_vendor_id and deleted_at is null for share;
  if not found then raise exception 'Choose an active vendor'; end if;
  perform 1 from public.properties where id = p_property_id and deleted_at is null for share;
  if not found then raise exception 'Choose an active property'; end if;

  select * into settings from public.approval_rule_settings where id = 1;
  select count(*), avg(amount) into history_count, history_average
  from public.invoices
  where vendor_id = p_vendor_id and property_id = p_property_id
    and deleted_at is null and status in ('approved', 'paid') and date < p_date;

  if not vendor_autopay then reasons := array_append(reasons, 'autopay_off'); end if;
  if settings.max_auto_approval_amount is null or settings.max_above_average_percent is null
    or settings.min_comparable_bills is null then
    reasons := array_append(reasons, 'settings_incomplete');
  end if;
  if settings.max_auto_approval_amount is not null
    and p_amount > settings.max_auto_approval_amount then
    reasons := array_append(reasons, 'amount_limit');
  end if;
  if settings.min_comparable_bills is not null and history_count < settings.min_comparable_bills then
    reasons := array_append(reasons, 'short_history');
  end if;
  if history_average is null then
    reasons := array_append(reasons, 'no_comparable_average');
  elsif settings.max_above_average_percent is not null
    and p_amount > history_average * (1 + settings.max_above_average_percent / 100) then
    reasons := array_append(reasons, 'unusual_amount');
  end if;

  decision := case when cardinality(reasons) = 0 then 'approved' else 'waiting on approval' end;
  insert into public.invoices (
    date, reference_number, vendor_id, property_id, amount, due_date, payment_url, status
  ) values (
    p_date, btrim(p_reference_number), p_vendor_id, p_property_id, p_amount,
    p_due_date, p_payment_url, decision
  ) returning id into new_invoice_id;

  insert into public.invoice_rule_evaluations (
    invoice_id, outcome, reasons, evaluated_amount, evaluated_date,
    evaluated_vendor_id, evaluated_property_id, autopay, max_auto_approval_amount,
    max_above_average_percent, min_comparable_bills, comparable_count, comparable_average
  ) values (
    new_invoice_id, decision, reasons, p_amount, p_date,
    p_vendor_id, p_property_id, vendor_autopay, settings.max_auto_approval_amount,
    settings.max_above_average_percent, settings.min_comparable_bills,
    history_count, round(history_average, 2)
  );

  return jsonb_build_object('id', new_invoice_id, 'status', decision, 'reasons', reasons);
end;
$$;

revoke all on function public.create_invoice_with_rules(date, text, uuid, uuid, numeric, date, text)
  from public, anon, authenticated;
grant execute on function public.create_invoice_with_rules(date, text, uuid, uuid, numeric, date, text)
  to authenticated;

create function public.approve_invoice_manually(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  update public.invoices set status = 'approved'
  where id = p_invoice_id and status = 'waiting on approval' and deleted_at is null;
  if not found then raise exception 'Invoice is not waiting on approval'; end if;
end;
$$;

revoke all on function public.approve_invoice_manually(uuid) from public, anon, authenticated;
grant execute on function public.approve_invoice_manually(uuid) to authenticated;

commit;
