begin;

-- This feature branch predates the confirmation migrations on main.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
alter table public.invoices add column if not exists payment_confirmation_number text;

create table public.payment_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  requested_by uuid not null references auth.users(id),
  snapshot jsonb not null,
  state text not null default 'queued' check (state in ('queued','preparing','awaiting_authorization','authorized','submitting','confirmed','failed','cancelled','expired','needs_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  authorized_by uuid references auth.users(id),
  authorized_at timestamptz,
  authorization_expires_at timestamptz,
  confirmation jsonb,
  error text
);
create unique index payment_agent_one_live_intent on public.payment_agent_jobs(invoice_id)
  where state not in ('failed','cancelled','expired');
create table public.payment_agent_steps (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.payment_agent_jobs(id),
  occurred_at timestamptz not null default now(),
  event jsonb not null
);
alter table public.payment_agent_jobs enable row level security;
alter table public.payment_agent_steps enable row level security;
revoke all on public.payment_agent_jobs, public.payment_agent_steps from public, anon, authenticated;
grant select on public.payment_agent_jobs, public.payment_agent_steps to authenticated;
grant all on public.payment_agent_jobs, public.payment_agent_steps to service_role;
grant usage, select on sequence public.payment_agent_steps_id_seq to service_role;
create policy "Shared role reads payment jobs" on public.payment_agent_jobs for select to authenticated using (true);
create policy "Shared role reads payment steps" on public.payment_agent_steps for select to authenticated using (true);

create function app_private.payment_agent_snapshot(p_invoice_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i public.invoices%rowtype; v public.vendors%rowtype; property_name text;
begin
  select * into i from public.invoices where id = p_invoice_id for update;
  if not found or i.deleted_at is not null or i.status <> 'approved' or i.payment_confirmation_number is not null then
    raise exception 'An active approved unpaid invoice is required';
  end if;
  select * into v from public.vendors where id = i.vendor_id for update;
  if not found or v.deleted_at is not null or nullif(btrim(v.account_number),'') is null then raise exception 'An active vendor and customer account are required'; end if;
  select name into property_name from public.properties where id = i.property_id and deleted_at is null;
  if property_name is null or nullif(btrim(i.payment_url),'') is null then raise exception 'An active property and mock payment URL are required'; end if;
  return jsonb_build_object('id',i.id,'vendorId',i.vendor_id,'propertyId',i.property_id,
    'vendorName',v.name,'accountNumber',v.account_number,'reference',i.reference_number,
    'amount',i.amount::text,'propertyName',property_name,'paymentUrl',i.payment_url,'status',i.status);
end $$;
revoke all on function app_private.payment_agent_snapshot(uuid) from public, anon, authenticated;

create function public.start_mock_payment_agent(p_invoice_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare snap jsonb; result uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  snap := app_private.payment_agent_snapshot(p_invoice_id);
  select id into result from public.payment_agent_jobs where invoice_id = p_invoice_id and state not in ('failed','cancelled','expired');
  if result is not null then return result; end if;
  insert into public.payment_agent_jobs(invoice_id,requested_by,snapshot) values(p_invoice_id,auth.uid(),snap) returning id into result;
  insert into public.payment_agent_steps(job_id,event) values(result,jsonb_build_object('state','queued','actor',auth.uid()));
  return result;
end $$;

create function public.authorize_mock_payment_agent(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.payment_agent_jobs%rowtype; snap jsonb;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into j from public.payment_agent_jobs where id=p_job_id;
  if not found then raise exception 'Payment job not found'; end if;
  snap := app_private.payment_agent_snapshot(j.invoice_id);
  select * into j from public.payment_agent_jobs where id=p_job_id for update;
  if j.state <> 'awaiting_authorization' or j.lease_until <= now() or j.authorization_expires_at <= now() or j.snapshot <> snap then raise exception 'Payment is not ready or its authorization window expired'; end if;
  update public.payment_agent_jobs set state='authorized', authorized_by=auth.uid(), authorized_at=now(),updated_at=now() where id=p_job_id;
  insert into public.payment_agent_steps(job_id,event) values(p_job_id,jsonb_build_object('state','authorized','actor',auth.uid()));
end $$;

create function public.cancel_mock_payment_agent(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  update public.payment_agent_jobs set state='cancelled',updated_at=now()
    where id=p_job_id and state in ('queued','preparing','awaiting_authorization','authorized');
  if not found then raise exception 'Job cannot be cancelled after submission starts'; end if;
  insert into public.payment_agent_steps(job_id,event) values(p_job_id,jsonb_build_object('state','cancelled','actor',auth.uid()));
end $$;

create function public.claim_mock_payment_agent() returns setof public.payment_agent_jobs
language plpgsql security definer set search_path = '' as $$
declare j public.payment_agent_jobs%rowtype;
begin
  -- Lost browser sessions are never resumed or resubmitted automatically.
  with stale as (
    update public.payment_agent_jobs set state=case when state='submitting' then 'needs_review' else 'failed' end,
      error='Worker lease expired; reconcile any uncertain payment before retrying',updated_at=now()
    where state in ('preparing','awaiting_authorization','authorized','submitting') and lease_until < now()
    returning id,state
  ) insert into public.payment_agent_steps(job_id,event) select id,jsonb_build_object('state',state,'error','Worker lease expired') from stale;
  select * into j from public.payment_agent_jobs where state='queued' order by created_at for update skip locked limit 1;
  if not found then return; end if;
  return query update public.payment_agent_jobs set state='preparing',lease_token=gen_random_uuid(),lease_until=now()+interval '60 seconds',updated_at=now() where id=j.id returning *;
end $$;

create function public.advance_mock_payment_agent(p_job_id uuid,p_token uuid,p_state text,p_event jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.payment_agent_jobs%rowtype; snap jsonb;
begin
  select * into j from public.payment_agent_jobs where id=p_job_id;
  if not found then raise exception 'Job not found'; end if;
  if p_state='submitting' then snap := app_private.payment_agent_snapshot(j.invoice_id); end if;
  select * into j from public.payment_agent_jobs where id=p_job_id for update;
  if j.lease_token is distinct from p_token or j.lease_until <= now() then raise exception 'Worker lease lost'; end if;
  if not ((p_state='heartbeat' and j.state in ('preparing','awaiting_authorization','authorized','submitting'))
    or (p_state='awaiting_authorization' and j.state='preparing')
    or (p_state='submitting' and j.state='authorized' and j.authorized_by is not null and j.authorization_expires_at>now() and snap=j.snapshot)
    or (p_state in ('failed','expired') and j.state in ('preparing','awaiting_authorization','authorized'))
    or (p_state='needs_review' and j.state='submitting')) then raise exception 'Invalid payment transition'; end if;
  update public.payment_agent_jobs set state=case when p_state='heartbeat' then state else p_state end,
    lease_until=now()+interval '60 seconds',updated_at=now(),
    authorization_expires_at=case when p_state='awaiting_authorization' then now()+interval '10 minutes' else authorization_expires_at end,
    error=case when p_state in ('failed','expired','needs_review') then left(p_event->>'error',500) else error end
    where id=p_job_id;
  if p_event <> '{}'::jsonb or p_state <> 'heartbeat' then
    insert into public.payment_agent_steps(job_id,event) values(p_job_id,p_event||jsonb_build_object('state',p_state));
  end if;
end $$;

create function public.finalize_mock_payment_agent(p_job_id uuid,p_token uuid,p_receipt jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare j public.payment_agent_jobs%rowtype; snap jsonb;
begin
  select * into j from public.payment_agent_jobs where id=p_job_id;
  if not found then raise exception 'Job not found'; end if;
  if j.state='confirmed' and j.confirmation=p_receipt then return; end if;
  snap:=app_private.payment_agent_snapshot(j.invoice_id);
  select * into j from public.payment_agent_jobs where id=p_job_id for update;
  if j.lease_token is distinct from p_token or j.state<>'submitting' or j.lease_until<=now() or snap<>j.snapshot then raise exception 'Payment finalization rejected'; end if;
  if p_receipt->>'status' is distinct from 'succeeded'
    or p_receipt->>'billId' is distinct from j.snapshot->>'reference'
    or p_receipt->>'accountNumber' is distinct from j.snapshot->>'accountNumber'
    or (p_receipt->>'amountCents')::numeric is distinct from (j.snapshot->>'amount')::numeric*100
    or nullif(p_receipt->>'confirmation','') is null
    or nullif(p_receipt->>'serviceAccountId','') is null
    or p_receipt->>'portalOrigin' is distinct from regexp_replace(substring(lower(j.snapshot->>'paymentUrl') from '^https://[^/#?]+'), ':443$', '') then raise exception 'Receipt does not match approved invoice'; end if;
  update public.payment_agent_jobs set state='confirmed',confirmation=p_receipt,updated_at=now() where id=p_job_id;
  update public.invoices set status='paid',payment_confirmation_number=p_receipt->>'confirmation' where id=j.invoice_id;
  insert into public.payment_agent_steps(job_id,event) values(p_job_id,jsonb_build_object('state','confirmed','receipt',p_receipt));
end $$;

-- Prevent manual confirmation/reopening/archiving from racing an agent intent.
create function app_private.protect_agent_invoice() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='paid' and new is distinct from old and exists(select 1 from public.payment_agent_jobs where invoice_id=old.id and state='confirmed') then
    raise exception 'Agent-paid invoices are read-only';
  end if;
  if new is distinct from old and exists(select 1 from public.payment_agent_jobs where invoice_id=old.id and state not in ('failed','cancelled','expired','confirmed')) then
    raise exception 'Cancel or reconcile the active mock payment before changing this invoice';
  end if;
  return new;
end $$;
create trigger protect_agent_invoice before update on public.invoices for each row execute function app_private.protect_agent_invoice();
create function app_private.protect_agent_vendor() returns trigger language plpgsql set search_path='' as $$
begin
  if (new.name,new.account_number,new.deleted_at) is distinct from (old.name,old.account_number,old.deleted_at)
    and exists(select 1 from public.payment_agent_jobs j join public.invoices i on i.id=j.invoice_id where i.vendor_id=old.id and j.state not in ('failed','cancelled','expired','confirmed')) then
    raise exception 'Cancel or reconcile the active mock payment before changing this vendor';
  end if;
  return new;
end $$;
create trigger protect_agent_vendor before update on public.vendors for each row execute function app_private.protect_agent_vendor();
revoke all on function app_private.protect_agent_invoice(),app_private.protect_agent_vendor() from public,anon,authenticated;

revoke all on function public.start_mock_payment_agent(uuid),public.authorize_mock_payment_agent(uuid),public.cancel_mock_payment_agent(uuid) from public,anon,authenticated;
grant execute on function public.start_mock_payment_agent(uuid),public.authorize_mock_payment_agent(uuid),public.cancel_mock_payment_agent(uuid) to authenticated;
revoke all on function public.claim_mock_payment_agent(),public.advance_mock_payment_agent(uuid,uuid,text,jsonb),public.finalize_mock_payment_agent(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_mock_payment_agent(),public.advance_mock_payment_agent(uuid,uuid,text,jsonb),public.finalize_mock_payment_agent(uuid,uuid,jsonb) to service_role;
commit;
