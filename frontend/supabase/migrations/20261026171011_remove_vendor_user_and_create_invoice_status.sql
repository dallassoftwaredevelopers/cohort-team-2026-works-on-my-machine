begin;

-- Vendors no longer require a linked Auth user. Dropping the column also
-- removes its unique constraint and foreign key with ON DELETE CASCADE.
alter table public.vendors drop column user_id;

-- Align future inserts and existing invoices with the invoice form.
alter table public.invoices
alter column status set default 'created';

update public.invoices
set status = 'created'
where status = 'pending';

-- Keep database values in sync with the statuses offered by the form.
alter table public.invoices
add constraint invoices_status_check
check (status in ('created', 'waiting on approval', 'approved', 'paid'));

commit;
