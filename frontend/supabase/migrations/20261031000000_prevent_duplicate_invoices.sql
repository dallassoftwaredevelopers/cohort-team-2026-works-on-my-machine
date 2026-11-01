-- An archived invoice still represents a real bill, so its identity remains
-- reserved. Normalize case and surrounding whitespace for comparisons.
-- If duplicate rows already exist, resolve them before applying this migration.
create unique index invoices_vendor_property_reference_unique_idx
  on public.invoices (vendor_id, property_id, lower(btrim(reference_number)));
