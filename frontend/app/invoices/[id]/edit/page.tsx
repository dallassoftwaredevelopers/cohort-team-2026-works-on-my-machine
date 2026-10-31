import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CCard, CCardBody, CCardHeader } from "@coreui/react";
import { createClient } from "@/utils/supabase/server";
import { isInvoiceStatus } from "@/lib/invoices/status";
import { InvoiceFormClient } from "../../InvoiceForm.client";
import styles from "../../upload/upload.module.scss";

type Props = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditInvoicePage({ params }: Props) {
  return (
    <CCard className={styles.uploader}>
      <CCardHeader className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <h1 className="h3 mb-1">Edit Invoice</h1>
          <p className="mb-0 text-body-secondary">Update the invoice details.</p>
        </div>
        <Link href="/invoices" className="btn btn-primary">View All Invoices</Link>
      </CCardHeader>
      <CCardBody>
        <Suspense fallback={<p className="text-body-secondary">Loading invoice…</p>}>
          <InvoiceEditor params={params} />
        </Suspense>
      </CCardBody>
    </CCard>
  );
}

async function InvoiceEditor({ params }: Props) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect(`/login?next=/invoices/${id}/edit`);

  const [invoiceResult, vendorResult, propertyResult] = await Promise.all([
    supabase.from("invoices")
      .select("id, reference_number, vendor_id, property_id, amount, due_date, payment_url, status")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("vendors").select("id, name, deleted_at").order("name"),
    supabase.from("properties").select("id, name, deleted_at").order("name"),
  ]);
  if (invoiceResult.error) throw invoiceResult.error;
  if (vendorResult.error) throw vendorResult.error;
  if (propertyResult.error) throw propertyResult.error;
  const invoice = invoiceResult.data;
  if (!invoice) notFound();
  if (!isInvoiceStatus(invoice.status)) throw new Error("Invoice has an unsupported status.");

  const vendors = vendorResult.data
    .filter((vendor) => !vendor.deleted_at || vendor.id === invoice.vendor_id)
    .map((vendor) => ({ id: vendor.id, name: vendor.deleted_at ? `${vendor.name} (archived)` : vendor.name }));
  const properties = propertyResult.data
    .filter((property) => !property.deleted_at || property.id === invoice.property_id)
    .map((property) => ({ id: property.id, name: property.deleted_at ? `${property.name} (archived)` : property.name }));

  return <InvoiceFormClient
    key={invoice.id}
    vendors={vendors}
    properties={properties}
    invoice={{
      id: invoice.id,
      fields: {
        invoiceNumber: invoice.reference_number,
        vendorId: invoice.vendor_id,
        propertyId: invoice.property_id,
        amountDue: String(invoice.amount),
        dueDate: invoice.due_date ?? "",
        paymentUrl: invoice.payment_url ?? "",
        status: invoice.status,
      },
    }}
  />;
}
