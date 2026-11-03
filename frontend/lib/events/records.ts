import type { SupabaseClient } from "@supabase/supabase-js";

type EventIds = {
  invoice_id: string | null;
  vendor_id: string | null;
  property_id: string | null;
  actor_user_id: string | null;
};
type Selection = { type: "invoice" | "vendor" | "property" | "actor"; id: string };

function ids(values: (string | null)[]) {
  return [...new Set(values.filter((value): value is string => value !== null))];
}

// Only fetch labels for this event page and the selected History target.
// Archived rows intentionally participate in these lookups.
export async function loadEventRecords(supabase: SupabaseClient, events: EventIds[], selected?: Selection) {
  const invoiceIds = ids([...events.map((event) => event.invoice_id), selected?.type === "invoice" ? selected.id : null]);
  const invoiceResult = invoiceIds.length
    ? await supabase.from("invoices").select("id, reference_number, vendor_id, property_id, deleted_at").in("id", invoiceIds)
    : { data: [], error: null };
  if (invoiceResult.error) throw invoiceResult.error;
  const invoices = invoiceResult.data ?? [];

  const vendorIds = ids([...events.map((event) => event.vendor_id), ...invoices.map((invoice) => invoice.vendor_id), selected?.type === "vendor" ? selected.id : null]);
  const propertyIds = ids([...events.map((event) => event.property_id), ...invoices.map((invoice) => invoice.property_id), selected?.type === "property" ? selected.id : null]);
  const actorIds = ids([...events.map((event) => event.actor_user_id), selected?.type === "actor" ? selected.id : null]);
  const [vendorResult, propertyResult, profileResult] = await Promise.all([
    vendorIds.length ? supabase.from("vendors").select("id, name, deleted_at").in("id", vendorIds) : { data: [], error: null },
    propertyIds.length ? supabase.from("properties").select("id, name, deleted_at").in("id", propertyIds) : { data: [], error: null },
    actorIds.length ? supabase.from("profiles").select("id, name").in("id", actorIds) : { data: [], error: null },
  ]);
  if (vendorResult.error) throw vendorResult.error;
  if (propertyResult.error) throw propertyResult.error;
  if (profileResult.error) throw profileResult.error;
  return {
    invoiceResult: { data: invoices },
    vendorResult: { data: vendorResult.data ?? [] },
    propertyResult: { data: propertyResult.data ?? [] },
    profileResult: { data: profileResult.data ?? [] },
  };
}
