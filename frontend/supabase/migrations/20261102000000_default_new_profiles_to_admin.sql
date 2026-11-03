-- The demo uses one shared application role. Existing profiles have already
-- been assigned by the team; future accounts get admin from the database.
begin;

alter table public.profiles alter column role set default 'admin';

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
    'admin'
  );
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_auth_user()
  from public, anon, authenticated;

commit;
