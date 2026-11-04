begin;

-- Archiving a test/incorrect bill releases its identity for a replacement.
-- All nonarchived statuses, including paid, still reserve that identity.
-- Keep the index name so the application's duplicate-error handling still works.
drop index public.invoices_vendor_property_reference_unique_idx;
create unique index invoices_vendor_property_reference_unique_idx
  on public.invoices (vendor_id, property_id, lower(btrim(reference_number)))
  where deleted_at is null;

commit;
