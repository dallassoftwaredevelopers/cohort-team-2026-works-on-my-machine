begin;

-- Approval attribution and timing will be recorded in the audit event history.
-- Dropping approved_by also removes its foreign key and index.
alter table public.invoices
  drop column approved_by,
  drop column date_approved;

-- NULL deleted_at means active. Archiving sets deleted_at and deleted_by;
-- restoring clears both. Existing rows remain active.
-- Keep the record itself so invoice relationships and future audit events survive.
alter table public.invoices
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  add constraint invoices_deletion_metadata_check
    check (deleted_at is not null or deleted_by is null);

alter table public.vendors
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  add constraint vendors_deletion_metadata_check
    check (deleted_at is not null or deleted_by is null);

alter table public.properties
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  add constraint properties_deletion_metadata_check
    check (deleted_at is not null or deleted_by is null);

-- Each event belongs to exactly one business record. Foreign keys keep history
-- attached to archived records, even when the actor's auth account is removed.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'system')),
  action text not null check (action in ('created', 'updated', 'archived', 'restored', 'approved')),
  occurred_at timestamptz not null default clock_timestamp(),
  changes jsonb not null default '{}'::jsonb,
  reason text,
  invoice_id uuid references public.invoices (id) on delete restrict,
  vendor_id uuid references public.vendors (id) on delete restrict,
  property_id uuid references public.properties (id) on delete restrict,
  constraint audit_events_one_target_check
    check (num_nonnulls(invoice_id, vendor_id, property_id) = 1)
);

create index audit_events_invoice_timeline_idx
  on public.audit_events (invoice_id, occurred_at desc) where invoice_id is not null;
create index audit_events_vendor_timeline_idx
  on public.audit_events (vendor_id, occurred_at desc) where vendor_id is not null;
create index audit_events_property_timeline_idx
  on public.audit_events (property_id, occurred_at desc) where property_id is not null;
create index audit_events_actor_timeline_idx
  on public.audit_events (actor_user_id, occurred_at desc) where actor_user_id is not null;

alter table public.audit_events enable row level security;
revoke all on table public.audit_events from public, anon, authenticated;
grant select on table public.audit_events to authenticated;
create policy "Signed-in users can read audit events"
  on public.audit_events for select to authenticated using (true);

-- Keep the privileged writer outside Supabase's exposed public schema. Only
-- row triggers call it; application roles cannot insert or edit audit events.
create schema if not exists audit_private;
revoke all on schema audit_private from public, anon, authenticated;

create function audit_private.log_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_values jsonb;
  new_values jsonb;
  changed_values jsonb;
  event_action text;
  actor_id uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'Archive % records by setting deleted_at instead of deleting them', tg_table_name;
  end if;

  new_values := to_jsonb(new);
  if tg_op = 'INSERT' then
    old_values := '{}'::jsonb;
    event_action := 'created';
  else
    old_values := to_jsonb(old);
    if old_values = new_values then
      return new;
    end if;

    if old.deleted_at is null and new.deleted_at is not null then
      event_action := 'archived';
    elsif old.deleted_at is not null and new.deleted_at is null then
      event_action := 'restored';
    else
      event_action := 'updated';
      if tg_table_name = 'invoices' then
        if old.status is distinct from new.status and new.status = 'approved' then
          event_action := 'approved';
        end if;
      end if;
    end if;
  end if;

  select coalesce(
    jsonb_object_agg(field.key, jsonb_build_object(
      'old', old_values -> field.key,
      'new', field.value
    )),
    '{}'::jsonb
  ) into changed_values
  from jsonb_each(new_values) as field
  where old_values -> field.key is distinct from field.value;

  actor_id := auth.uid();
  insert into public.audit_events (
    actor_user_id, actor_type, action, changes,
    invoice_id, vendor_id, property_id
  ) values (
    actor_id,
    case when actor_id is null then 'system' else 'user' end,
    event_action,
    changed_values,
    case when tg_table_name = 'invoices' then new.id end,
    case when tg_table_name = 'vendors' then new.id end,
    case when tg_table_name = 'properties' then new.id end
  );

  return new;
end;
$$;

revoke all on function audit_private.log_row_change() from public, anon, authenticated;

create trigger audit_invoice_changes
  after insert or update on public.invoices
  for each row execute function audit_private.log_row_change();
create trigger prevent_invoice_hard_delete
  before delete on public.invoices
  for each row execute function audit_private.log_row_change();

create trigger audit_vendor_changes
  after insert or update on public.vendors
  for each row execute function audit_private.log_row_change();
create trigger prevent_vendor_hard_delete
  before delete on public.vendors
  for each row execute function audit_private.log_row_change();

create trigger audit_property_changes
  after insert or update on public.properties
  for each row execute function audit_private.log_row_change();
create trigger prevent_property_hard_delete
  before delete on public.properties
  for each row execute function audit_private.log_row_change();

-- Application actions must switch from DELETE to UPDATE, and active
-- lists/selectors must filter WHERE deleted_at IS NULL. Historical invoice
-- reads should still resolve archived vendors and properties. Approval
-- explanations can be written to reason by a future privileged workflow.

commit;
