import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import FilterForm, { type FilterOptions, type FilterType } from "./FilterForm.client";

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };
type Change = { old: unknown; new: unknown };
type AuditEvent = {
  id: string;
  actor_user_id: string | null;
  actor_type: "user" | "system";
  action: string;
  occurred_at: string;
  changes: Record<string, Change>;
  reason: string | null;
  invoice_id: string | null;
  vendor_id: string | null;
  property_id: string | null;
};

const pageSize = 50;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const filterColumns: Record<FilterType, string> = {
  invoice: "invoice_id",
  vendor: "vendor_id",
  property: "property_id",
  actor: "actor_user_id",
};
const fieldLabels: Record<string, string> = {
  name: "Name",
  address: "Address",
  account_number: "Account number",
  payment_type: "Payment type",
  autopay: "Autopay",
  reference_number: "Reference number",
  vendor_id: "Vendor ID",
  property_id: "Property ID",
  amount: "Amount",
  date: "Invoice date",
  due_date: "Due date",
  payment_url: "Payment URL",
  status: "Status",
  deleted_at: "Archived at",
  deleted_by: "Archived by user ID",
};
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
});
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function filterType(value: string): value is FilterType {
  return Object.hasOwn(filterColumns, value);
}

function valueText(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "autopay" && typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field === "amount" && (typeof value === "number" || typeof value === "string") && Number.isFinite(Number(value))) {
    return money.format(Number(value));
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function pageHref(type: FilterType | "", id: string, page: number) {
  const params = new URLSearchParams();
  if (type && id) { params.set("type", type); params.set("id", id); }
  params.set("page", String(page));
  return `/events?${params}`;
}

export default function EventsPage({ searchParams }: Props) {
  return (
    <>
      <header className="mb-4">
        <h1 className="h3 mb-1">Activity</h1>
        <p className="text-body-secondary mb-0">See who changed an invoice, vendor, or property, and what changed.</p>
      </header>
      <Suspense fallback={<p className="text-body-secondary">Loading activity…</p>}>
        <EventViewer searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function EventViewer({ searchParams }: Props) {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect("/login?next=/events");

  const params = await searchParams;
  const requestedType = typeof params.type === "string" ? params.type : "";
  const requestedId = typeof params.id === "string" ? params.id : "";
  const type = filterType(requestedType) ? requestedType : "";
  const validFilter = (!requestedType && !requestedId) || (Boolean(type) && uuid.test(requestedId));
  const page = typeof params.page === "string" && /^[1-9]\d{0,3}$/.test(params.page) ? Number(params.page) : 1;

  const [invoiceResult, vendorResult, propertyResult, profileResult] = await Promise.all([
    supabase.from("invoices").select("id, reference_number, vendor_id, property_id, deleted_at").order("reference_number"),
    supabase.from("vendors").select("id, name, deleted_at").order("name"),
    supabase.from("properties").select("id, name, deleted_at").order("name"),
    supabase.from("profiles").select("id, name").order("name"),
  ]);
  if (invoiceResult.error) throw invoiceResult.error;
  if (vendorResult.error) throw vendorResult.error;
  if (propertyResult.error) throw propertyResult.error;
  if (profileResult.error) throw profileResult.error;

  const vendors = new Map(vendorResult.data.map((vendor) => [vendor.id, vendor.name]));
  const properties = new Map(propertyResult.data.map((property) => [property.id, property.name]));
  const actors = new Map(profileResult.data.map((profile) => [profile.id, profile.name]));
  const invoiceNames = new Map(invoiceResult.data.map((invoice) => [
    invoice.id, `${vendors.get(invoice.vendor_id) ?? "Unknown vendor"} ${invoice.reference_number}`,
  ]));
  const options: FilterOptions = {
    invoice: invoiceResult.data.map((invoice) => ({
      id: invoice.id,
      label: `${invoiceNames.get(invoice.id) ?? invoice.reference_number} for ${properties.get(invoice.property_id) ?? "Unknown property"}${invoice.deleted_at ? " (archived)" : ""}`,
    })),
    vendor: vendorResult.data.map((vendor) => ({ id: vendor.id, label: `${vendor.name}${vendor.deleted_at ? " (archived)" : ""}` })),
    property: propertyResult.data.map((property) => ({ id: property.id, label: `${property.name}${property.deleted_at ? " (archived)" : ""}` })),
    actor: profileResult.data.map((profile) => ({ id: profile.id, label: profile.name })),
  };
  const validSelection = validFilter && (!type || options[type].some((option) => option.id === requestedId));

  let events: AuditEvent[] = [];
  if (validSelection) {
    let query = supabase.from("audit_events")
      .select("id, actor_user_id, actor_type, action, occurred_at, changes, reason, invoice_id, vendor_id, property_id")
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize);
    if (type) query = query.eq(filterColumns[type], requestedId);
    const result = await query;
    if (result.error) throw result.error;
    events = (result.data ?? []) as AuditEvent[];
  }
  const hasNext = events.length > pageSize;
  const visibleEvents = events.slice(0, pageSize);
  const selectedLabel = type ? options[type].find((option) => option.id === requestedId)?.label : undefined;

  return (
    <>
      <FilterForm key={`${type}:${requestedId}:${page}`} options={options} initialType={type} initialId={validSelection ? requestedId : ""} />
      {!validSelection ? <p role="alert" className="alert alert-warning">Choose a valid record or user to view its activity.</p> : (
        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="h5 mb-3">{type === "actor" ? `Actions by ${selectedLabel ?? "user"}` : selectedLabel ? `History: ${selectedLabel}` : "Recent activity"}</h2>
          {visibleEvents.length === 0 ? <p className="card card-body text-body-secondary">No events found for this filter.</p> : (
            <ol className="list-group mb-3">
              {visibleEvents.map((event) => {
                const target = event.invoice_id ? invoiceNames.get(event.invoice_id)
                  : event.vendor_id ? options.vendor.find((option) => option.id === event.vendor_id)?.label
                    : options.property.find((option) => option.id === event.property_id)?.label;
                const actorName = event.actor_type === "system" ? "System"
                  : event.actor_user_id ? actors.get(event.actor_user_id) ?? "Former user" : "Former user";
                const changes = Object.entries(event.changes ?? {}).filter(([field]) => field !== "id");
                return (
                  <li key={event.id} className="list-group-item">
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <div><span className="badge text-bg-secondary me-2 text-capitalize">{event.action}</span><strong>{target ?? "Record"}</strong></div>
                      <time className="text-body-secondary small" dateTime={event.occurred_at}>{dateFormat.format(new Date(event.occurred_at))}</time>
                    </div>
                    <p className="small text-body-secondary mb-1">By {event.actor_user_id && event.actor_type === "user"
                      ? <Link href={`/events?type=actor&id=${event.actor_user_id}`}>{actorName}</Link> : actorName}</p>
                    {event.reason && <p className="mb-1">Reason: {event.reason}</p>}
                    {changes.length > 0 && <details open={event.action === "updated" || event.action === "approved"}>
                      <summary>Changed fields</summary>
                      <ul className="mb-0 mt-2 small">
                        {changes.map(([field, change]) => (
                          <li key={field}><strong>{fieldLabels[field] ?? field.replaceAll("_", " ")}:</strong> {valueText(field, change?.old)} → {valueText(field, change?.new)}</li>
                        ))}
                      </ul>
                    </details>}
                  </li>
                );
              })}
            </ol>
          )}
          {(page > 1 || hasNext) && <nav aria-label="Activity pages" className="d-flex gap-2">
            {page > 1 && <Link className="btn btn-outline-secondary" href={pageHref(type, requestedId, page - 1)}>Previous</Link>}
            {hasNext && <Link className="btn btn-outline-secondary" href={pageHref(type, requestedId, page + 1)}>Next</Link>}
          </nav>}
        </section>
      )}
    </>
  );
}
