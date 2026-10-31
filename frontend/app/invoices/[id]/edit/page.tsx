import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isInvoiceStatus } from "@/lib/invoices/status";
import { InvoiceFormClient } from "../../InvoiceForm.client";
import styles from "../../invoice-form.module.scss";

type Props = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditInvoicePage({ params }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.pageEyebrow}>Utility Bill Pay</p>
          <h1 className={styles.pageTitle}>Edit invoice</h1>
        </div>
        <Link href="/invoices" className={styles.backLink}>Back to invoices</Link>
      </header>
      <Suspense fallback={<p className="text-body-secondary">Loading invoice…</p>}>
        <InvoiceEditor params={params} />
      </Suspense>
    </div>
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
    supabase.from("vendors").select("id, name, account_number, deleted_at").order("name"),
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
    .map((vendor) => ({ id: vendor.id, name: vendor.deleted_at ? `${vendor.name} (archived)` : vendor.name, account_number: vendor.account_number }));
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
