import { createClient } from "@/utils/supabase/server";
import { extractInvoiceFromPdf } from "@/lib/invoices/extract-invoice";

const MAX_PDF_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) {
    return Response.json({ error: "Sign in before extracting invoice details." }, { status: 401 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Could not read the uploaded file." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a PDF file." }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return Response.json({ error: "Choose a PDF smaller than 4 MB." }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPdf = bytes.length >= 5
      && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44
      && bytes[3] === 0x46 && bytes[4] === 0x2d;
    if (!isPdf) {
      return Response.json({ error: "The selected file is not a PDF." }, { status: 400 });
    }

    const details = await extractInvoiceFromPdf(bytes);
    if (Object.values(details).every((value) => value === null)) {
      return Response.json({ error: "No invoice details found. Scanned PDFs need OCR; enter the details manually." }, { status: 422 });
    }
    return Response.json({ details });
  } catch (error) {
    console.error("Invoice PDF extraction failed", error);
    return Response.json({ error: "Could not extract this PDF. Enter the details manually." }, { status: 422 });
  }
}
