import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { invoiceStatusLabels, isInvoiceStatus } from "@/lib/invoices/status";
import ClickableTableRow from "@/components/ClickableTableRow.client";
import RefreshWhileProcessing from "@/components/RefreshWhileProcessing.client";
import { invoiceEditUrl, invoiceListUrl, invoiceView, type InvoiceView } from "@/lib/invoices/list-view";

type Props = { searchParams: Promise<{ view?: string | string[] }> };
const views: { value: InvoiceView; label: string; empty: string }[] = [
  { value: "active", label: "Active", empty: "No active invoices." },
  { value: "paid", label: "Paid", empty: "No paid invoices." },
  { value: "all", label: "All", empty: "No invoices." },
];

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
  approved: "text-bg-primary",
  "payment processing": "text-bg-primary",
  paid: "text-bg-success",
};

export default function InvoicesPage({ searchParams }: Props) {
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <h1 className="h3 mb-0">Invoices</h1>
        <Link href="/invoices/new" className="btn btn-primary">
          New Invoice
        </Link>
      </div>

      <Suspense fallback={<p className="text-body-secondary">Loading invoices…</p>}>
        <InvoiceTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InvoiceTable({ searchParams }: Props) {
  const view = invoiceView((await searchParams).view);
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect(`/login?${new URLSearchParams({ next: invoiceListUrl(view) })}`);

  let query = supabase
    .from("invoices")
    .select("id, date, reference_number, amount, due_date, status, vendor:vendors(name), property:properties(name)")
    .is("deleted_at", null);
  if (view === "active") query = query.neq("status", "paid");
  if (view === "paid") query = query.eq("status", "paid");
  const { data: invoices, error } = await query
    .order("date", { ascending: false })
    .overrideTypes<InvoiceRow[], { merge: false }>();
  if (error) throw error;

  return (
    <>
      <nav className="btn-group mb-3" aria-label="Invoice view">
        {views.map((option) => <Link key={option.value} href={invoiceListUrl(option.value)}
          className={`btn btn-sm ${view === option.value ? "btn-primary" : "btn-outline-primary"}`}
          aria-current={view === option.value ? "page" : undefined}>
          {option.label}
        </Link>)}
      </nav>
      <RefreshWhileProcessing active={invoices.some((invoice) => invoice.status === "payment processing")} />
      {invoices.length === 0 ? (
        <p className="card card-body text-body-secondary">{views.find((option) => option.value === view)!.empty}</p>
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
                <ClickableTableRow key={invoice.id} href={invoiceEditUrl(invoice.id, view)}>
                  <td className="fw-medium"><Link href={invoiceEditUrl(invoice.id, view)} className="text-body text-decoration-none" aria-label={`${invoice.status === "paid" ? "View" : "Edit"} invoice ${invoice.reference_number}`}>{invoice.reference_number}</Link></td>
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
