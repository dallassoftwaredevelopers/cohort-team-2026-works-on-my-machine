import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isInvoiceStatus } from "@/lib/invoices/status";
import { InvoiceFormClient } from "../../InvoiceForm.client";
import styles from "../../invoice-form.module.scss";
import { invoiceDocumentBucket } from "@/lib/invoices/document";
import { getAccess } from "@/lib/users/access";
import { browserUseConfigured } from "@/lib/invoices/browser-use";
import { paymentWorkerConfigured } from "@/lib/invoices/payment-worker-client";
import type { PaymentView } from "../../payment-actions";
import { invoiceEditUrl, invoiceListUrl, invoiceView } from "@/lib/invoices/list-view";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string | string[] }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditInvoicePage(props: Props) {
  return (
    <div className={styles.page}>
      <Suspense fallback={<p className="text-body-secondary">Loading invoice…</p>}>
        <InvoiceEditor {...props} />
      </Suspense>
    </div>
  );
}

async function InvoiceEditor({ params, searchParams }: Props) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const view = invoiceView(search.view);
  const returnHref = invoiceListUrl(view);
  if (!uuid.test(id)) notFound();

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect(`/login?${new URLSearchParams({ next: invoiceEditUrl(id, view) })}`);
  const { role } = await getAccess();

  const [invoiceResult, vendorResult, propertyResult, evaluationResult] = await Promise.all([
    supabase.from("invoices")
      .select("id, reference_number, vendor_id, property_id, amount, due_date, payment_url, status, document_path, document_name, document_mime_type, payment_confirmation_number")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("vendors").select("id, name, account_number, deleted_at").order("name"),
    supabase.from("properties").select("id, name, deleted_at").order("name"),
    supabase.from("invoice_rule_evaluations")
      .select("outcome, reasons, evaluated_amount, comparable_count, comparable_average, max_auto_approval_amount, max_above_average_percent, min_comparable_bills")
      .eq("invoice_id", id)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (invoiceResult.error) throw invoiceResult.error;
  if (vendorResult.error) throw vendorResult.error;
  if (propertyResult.error) throw propertyResult.error;
  if (evaluationResult.error) throw evaluationResult.error;
  const invoice = invoiceResult.data;
  if (!invoice) notFound();
  if (!isInvoiceStatus(invoice.status)) throw new Error("Invoice has an unsupported status.");

  const paymentsEnabled = browserUseConfigured() && paymentWorkerConfigured();
  let paymentAttempt: PaymentView | null = null;
  if (invoice.status === "payment processing" || (invoice.status === "approved" && paymentsEnabled)) {
    const payment = await supabase.from("invoice_payment_attempts")
      .select("id, run_id, status, message, created_at")
      .eq("invoice_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (payment.error) throw payment.error;
    paymentAttempt = payment.data as PaymentView | null;
  }

  let document: { url?: string; mime?: string; name?: string; error?: string } | undefined;
  if (invoice.document_path) {
    const signed = await supabase.storage.from(invoiceDocumentBucket).createSignedUrl(invoice.document_path, 3600);
    document = {
      url: signed.data?.signedUrl,
      mime: invoice.document_mime_type ?? undefined,
      name: invoice.document_name ?? undefined,
      error: signed.error ? "Could not load this document. Refresh to try again." : undefined,
    };
  }

  const vendors = vendorResult.data
    .filter((vendor) => !vendor.deleted_at || vendor.id === invoice.vendor_id)
    .map((vendor) => ({ id: vendor.id, name: vendor.deleted_at ? `${vendor.name} (archived)` : vendor.name, account_number: vendor.account_number }));
  const properties = propertyResult.data
    .filter((property) => !property.deleted_at || property.id === invoice.property_id)
    .map((property) => ({ id: property.id, name: property.deleted_at ? `${property.name} (archived)` : property.name }));

  return <>
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.pageEyebrow}>Utility Bill Pay</p>
        <h1 className={styles.pageTitle}>{invoice.status === "paid" ? "View invoice" : "Edit invoice"}</h1>
      </div>
      <Link href={returnHref} className={styles.backLink}>Back to {view === "paid" ? "paid invoices" : view === "all" ? "all invoices" : "invoices"}</Link>
    </header>
    <InvoiceFormClient
      key={JSON.stringify({ ...invoice, payment_confirmation_number: undefined })}
      vendors={vendors}
      properties={properties}
      evaluation={evaluationResult.data}
      document={document}
      paymentConfirmation={invoice.payment_confirmation_number}
      returnHref={returnHref}
      demoPayment={{ enabled: paymentsEnabled, attempt: paymentAttempt }}
      canViewHistory={role === "admin"}
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
    />
  </>;
}
