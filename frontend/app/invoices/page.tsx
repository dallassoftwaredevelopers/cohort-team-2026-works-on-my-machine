import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { invoiceStatusLabels, isInvoiceStatus } from "@/lib/invoices/status";
import ArchiveButton from "@/components/ArchiveButton.client";
import { archiveInvoice } from "./upload/actions";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

function formatDate(value: string | null) {
  return value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : "—";
}

type InvoiceRow = {
  id: string;
  date: string;
  reference_number: string;
  amount: number;
  due_date: string | null;
  payment_url: string | null;
  status: string;
  vendor: { name: string } | null;
  property: { name: string } | null;
};

const statusBadge: Record<string, string> = {
  created: "text-bg-secondary",
  "waiting on approval": "text-bg-warning",
  approved: "text-bg-info",
  paid: "text-bg-success",
};

export default function InvoicesPage() {
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <h1 className="h3 mb-0">Invoices</h1>
        <Link href="/invoices/upload" className="btn btn-primary">
          New Invoice
        </Link>
      </div>

      <Suspense fallback={<p className="text-body-secondary">Loading invoices…</p>}>
        <InvoiceTable />
      </Suspense>
    </>
  );
}

async function InvoiceTable() {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect("/login?next=/invoices");

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, date, reference_number, amount, due_date, payment_url, status, vendor:vendors(name), property:properties(name)")
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .overrideTypes<InvoiceRow[], { merge: false }>();
  if (error) throw error;

  return (
    <>
      {invoices.length === 0 ? (
        <p className="card card-body text-body-secondary">No invoices yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th scope="col">Invoice #</th>
                <th scope="col">Vendor</th>
                <th scope="col">Property</th>
                <th scope="col" className="text-end">Amount</th>
                <th scope="col">Date</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="fw-medium">{invoice.reference_number}</td>
                  <td>{invoice.vendor?.name ?? "—"}</td>
                  <td>{invoice.property?.name ?? "—"}</td>
                  <td className="text-end">{currency.format(Number(invoice.amount))}</td>
                  <td>{formatDate(invoice.date)}</td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td>
                    <span className={`badge ${statusBadge[invoice.status] ?? "text-bg-light"}`}>
                      {isInvoiceStatus(invoice.status) ? invoiceStatusLabels[invoice.status] : invoice.status}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-3">
                      {invoice.payment_url && (
                        <a href={invoice.payment_url} target="_blank" rel="noreferrer">Pay</a>
                      )}
                      <Link href={`/invoices/${invoice.id}/edit`} aria-label={`Edit invoice ${invoice.reference_number}`}>Edit</Link>
                      <ArchiveButton action={archiveInvoice} id={invoice.id} name={invoice.reference_number} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
