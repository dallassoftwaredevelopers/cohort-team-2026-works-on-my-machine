begin;

-- Preserve the dashboard-created bucket and make its configuration reproducible.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoice-pdfs', 'invoice-pdfs', false, 4194304,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.invoices
  add column document_path text unique,
  add column document_name text,
  add column document_mime_type text,
  add column payment_confirmation_number text
    check (payment_confirmation_number is null or length(btrim(payment_confirmation_number)) between 1 and 200),
  add constraint invoices_document_fields_check check (
    (document_path is null and document_name is null and document_mime_type is null)
    or (document_path is not null and document_name is not null and document_mime_type is not null)
  );

create policy "Signed-in users can read invoice documents"
  on storage.objects for select to authenticated using (bucket_id = 'invoice-pdfs');
create policy "Users can upload invoice documents to their folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'invoice-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users can clean up their unattached invoice documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'invoice-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.invoices where document_path = storage.objects.name));

-- Wrap the existing rule evaluator so attachment linkage is in its transaction.
create function public.create_invoice_with_document(
  p_date date, p_reference_number text, p_vendor_id uuid, p_property_id uuid,
  p_amount numeric, p_due_date date, p_payment_url text,
  p_document_path text, p_document_name text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  result jsonb;
  mime text;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_document_path is not null then
    if split_part(p_document_path, '/', 1) <> auth.uid()::text
      or p_document_name is null or length(btrim(p_document_name)) not between 1 and 255 then
      raise exception 'Invalid invoice document';
    end if;
    -- Lock the object until its invoice reference is saved.
    select metadata ->> 'mimetype' into mime from storage.objects
    where bucket_id = 'invoice-pdfs' and name = p_document_path for update;
    if not found or mime is null or mime not in (
      'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'
    ) then raise exception 'Invoice document was not uploaded'; end if;
  end if;
  result := public.create_invoice_with_rules(p_date, p_reference_number, p_vendor_id,
    p_property_id, p_amount, p_due_date, p_payment_url);
  if p_document_path is not null then
    update public.invoices set document_path = p_document_path,
      document_name = btrim(p_document_name), document_mime_type = mime
    where id = (result ->> 'id')::uuid;
  end if;
  return result;
end;
$$;
revoke all on function public.create_invoice_with_document(date, text, uuid, uuid, numeric, date, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_invoice_with_document(date, text, uuid, uuid, numeric, date, text, text, text)
  to authenticated;

-- Keep the invoice's approved fields locked, while allowing this specific update.
create function public.save_invoice_payment_confirmation(p_invoice_id uuid, p_confirmation text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_confirmation is null or length(btrim(p_confirmation)) not between 1 and 200 then
    raise exception 'Enter a confirmation number of up to 200 characters';
  end if;
  update public.invoices set payment_confirmation_number = btrim(p_confirmation)
  where id = p_invoice_id and status in ('approved', 'paid') and deleted_at is null;
  if not found then raise exception 'Only approved or paid invoices can receive a payment confirmation'; end if;
end;
$$;
revoke all on function public.save_invoice_payment_confirmation(uuid, text) from public, anon, authenticated;
grant execute on function public.save_invoice_payment_confirmation(uuid, text) to authenticated;

commit;
