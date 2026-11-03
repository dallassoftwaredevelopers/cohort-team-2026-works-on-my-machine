import { createClient } from "@/utils/supabase/server";
import { documentFormat, invoiceDocumentBucket, maxDocumentBytes } from "@/lib/invoices/document";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError || !data?.claims) return Response.json({ error: "Sign in to upload an invoice." }, { status: 401 });
  let file: FormDataEntryValue | null;
  try { file = (await request.formData()).get("file"); }
  catch { return Response.json({ error: "Could not read the document." }, { status: 400 }); }
  if (!(file instanceof File) || !file.size || file.size > maxDocumentBytes) {
    return Response.json({ error: "Choose a PDF or image up to 4 MB." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = documentFormat(bytes);
  if (!format) return Response.json({ error: "Use a PDF, PNG, JPEG, WebP, or GIF file." }, { status: 415 });
  const path = `${data.claims.sub}/${crypto.randomUUID()}.${format.extension}`;
  const { error } = await supabase.storage.from(invoiceDocumentBucket).upload(path, bytes, { contentType: format.mime, upsert: false });
  if (error) return Response.json({ error: "Could not store the invoice document. Please try again." }, { status: 500 });
  return Response.json({ path, name: file.name.slice(0, 255) || `invoice.${format.extension}` });
}
