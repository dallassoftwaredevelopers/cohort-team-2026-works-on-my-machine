-- Global thresholds for a future automatic invoice approval workflow.
-- NULL means the setting has not been configured; approval must fail closed
-- until all three values have been supplied.
create table public.approval_rule_settings (
  id integer primary key default 1 check (id = 1),
  max_auto_approval_amount numeric(12, 2)
    check (max_auto_approval_amount > 0),
  max_above_average_percent numeric(7, 2)
    check (max_above_average_percent >= 0),
  min_comparable_bills integer
    check (min_comparable_bills >= 1)
);

insert into public.approval_rule_settings default values;

alter table public.approval_rule_settings enable row level security;
revoke all on table public.approval_rule_settings from public, anon, authenticated;
grant select, update on table public.approval_rule_settings to authenticated;

create policy "Signed-in users can read approval rule settings"
  on public.approval_rule_settings for select to authenticated using (true);

create policy "Admins can update approval rule settings"
  on public.approval_rule_settings for update to authenticated
  using ((select app_private.is_admin()))
  with check ((select app_private.is_admin()));
