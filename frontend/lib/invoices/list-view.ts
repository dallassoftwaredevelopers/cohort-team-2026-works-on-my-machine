export type InvoiceView = "active" | "paid" | "all";

export function invoiceView(value: string | string[] | undefined): InvoiceView {
  return value === "paid" || value === "all" ? value : "active";
}

export function invoiceListUrl(view: InvoiceView): string {
  return view === "active" ? "/invoices" : `/invoices?view=${view}`;
}

export function invoiceEditUrl(id: string, view: InvoiceView): string {
  return `/invoices/${id}/edit${view === "active" ? "" : `?view=${view}`}`;
}
