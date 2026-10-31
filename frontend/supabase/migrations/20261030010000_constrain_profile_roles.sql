begin;

-- Normalize the original unrestricted role text before constraining it.
-- The first admin must be assigned deliberately to a known existing account.
update public.profiles
set role = 'clerk'
where role is null or role not in ('clerk', 'approver', 'admin');

alter table public.profiles
  alter column role set default 'clerk',
  alter column role set not null,
  add constraint profiles_role_check check (role in ('clerk', 'approver', 'admin'));

-- Future signups get the least privileged role. Keep the profile trigger's
-- security-definer context so it can insert despite the policy below.
create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'User'
    ),
    'clerk'
  );
  return new;
end;
$$;

-- This function reads the caller's current database role without recursing
-- into the profiles RLS policy. It is outside the exposed public schema.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function app_private.is_admin() from public, anon, authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_admin() to authenticated;

drop policy "Signed-in users can add profiles" on public.profiles;
drop policy "Signed-in users can edit profiles" on public.profiles;
drop policy "Signed-in users can delete profiles" on public.profiles;

revoke insert, delete on table public.profiles from authenticated;
create policy "Admins can edit profiles"
  on public.profiles for update to authenticated
  using ((select app_private.is_admin()))
  with check ((select app_private.is_admin()));

-- Avoid locking the team out by demoting its last admin. This also catches
-- direct Supabase API updates, not only the application's user editor.
create function app_private.prevent_last_admin_demote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' then
    perform pg_catalog.pg_advisory_xact_lock(2026, 1030);
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'Cannot change the last admin to another role';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.prevent_last_admin_demote() from public, anon, authenticated;
create trigger prevent_last_admin_demote
  before update of role on public.profiles
  for each row execute function app_private.prevent_last_admin_demote();

commit;
