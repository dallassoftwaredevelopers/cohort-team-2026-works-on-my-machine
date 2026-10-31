begin;

-- Contact fields are no longer used. Add fresh payment fields rather than
-- reinterpreting any existing email or address values as payment information.
-- Account numbers are text to preserve leading zeros, letters, and hyphens.
alter table public.vendors
  drop column email,
  drop column address,
  add column account_number text,
  add column payment_type text,
  add column autopay boolean not null default false;

commit;
