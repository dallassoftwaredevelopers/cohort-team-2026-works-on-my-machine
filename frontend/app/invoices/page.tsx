import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { invoiceStatusLabels, isInvoiceStatus } from "@/lib/invoices/status";
import ClickableTableRow from "@/components/ClickableTableRow.client";

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
        <Link href="/invoices/new" className="btn btn-primary">
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
    .select("id, date, reference_number, amount, due_date, status, vendor:vendors(name), property:properties(name)")
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
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th scope="col">Invoice #</th>
                <th scope="col">Vendor</th>
                <th scope="col">Property</th>
                <th scope="col" className="text-end">Amount</th>
                <th scope="col">Date</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <ClickableTableRow key={invoice.id} href={`/invoices/${invoice.id}/edit`}>
                  <td className="fw-medium"><Link href={`/invoices/${invoice.id}/edit`} className="text-body text-decoration-none" aria-label={`Edit invoice ${invoice.reference_number}`}>{invoice.reference_number}</Link></td>
                  <td>{invoice.vendor?.name ?? "—"}</td>
                  <td>{invoice.property?.name ?? "—"}</td>
                  <td className="text-end">{currency.format(Number(invoice.amount))}</td>
                  <td>{formatDate(invoice.date)}</td>
                  <td>{formatDate(invoice.due_date)}</td>
                  <td>
                    <span style={{ width: "10rem" }} className={`badge d-inline-block text-center ${statusBadge[invoice.status] ?? "text-bg-light"}`}>
                      {isInvoiceStatus(invoice.status) ? invoiceStatusLabels[invoice.status] : invoice.status}
                    </span>
                  </td>
                </ClickableTableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
