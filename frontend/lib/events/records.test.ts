import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEventRecords } from "./records";

type Row = { id: string; [field: string]: string | null };

function database(tables: Record<string, Row[]>, failure?: string) {
  const calls: { table: string; ids: string[] }[] = [];
  const client = {
    from(table: string) {
      return { select() {
        return { async in(column: string, ids: string[]) {
          assert.equal(column, "id");
          assert.ok(ids.length > 0, "empty ID lists should skip the query");
          calls.push({ table, ids });
          if (table === failure) return { data: null, error: new Error("Lookup failed") };
          // Model the database row cap after applying the ID filter.
          return { data: (tables[table] ?? []).filter((row) => ids.includes(row.id)).slice(0, 1000), error: null };
        } };
      } };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const emptyIds = { invoice_id: null, vendor_id: null, property_id: null, actor_user_id: null };

test("labels beyond the first 1,000 rows are loaded by ID, including archived invoice references", async () => {
  const filler = Array.from({ length: 1000 }, (_, index) => ({ id: `filler-${index}`, name: "Earlier name" }));
  const archived = "2026-10-01T00:00:00Z";
  const db = database({
    invoices: [...filler, { id: "invoice", reference_number: "Z-1001", vendor_id: "vendor", property_id: "property", deleted_at: archived }],
    vendors: [...filler, { id: "vendor", name: "Real vendor", deleted_at: archived }],
    properties: [...filler, { id: "property", name: "Real property", deleted_at: archived }],
    profiles: [...filler, { id: "actor", name: "Real person" }],
  });
  const event = { ...emptyIds, invoice_id: "invoice", actor_user_id: "actor" };
  const result = await loadEventRecords(db.client, [event, event]);
  assert.equal(result.invoiceResult.data[0].reference_number, "Z-1001");
  assert.equal(result.vendorResult.data[0].name, "Real vendor");
  assert.equal(result.propertyResult.data[0].name, "Real property");
  assert.equal(result.profileResult.data[0].name, "Real person");
  assert.equal(result.vendorResult.data[0].deleted_at, archived);
  assert.equal(result.propertyResult.data[0].deleted_at, archived);
  assert.equal(result.invoiceResult.data[0].deleted_at, archived);
  assert.equal(db.calls.length, 4);
  for (const call of db.calls) assert.equal(call.ids.length, 1, "IDs are deduplicated");
});

test("a selected record is loaded even when its event page is empty", async () => {
  for (const type of ["invoice", "vendor", "property", "actor"] as const) {
    const db = database({
      invoices: [{ id: "selected", reference_number: "INV-1", vendor_id: "vendor", property_id: "property", deleted_at: null }],
      vendors: [{ id: "selected", name: "Selected vendor" }, { id: "vendor", name: "Invoice vendor" }],
      properties: [{ id: "selected", name: "Selected property" }, { id: "property", name: "Invoice property" }],
      profiles: [{ id: "selected", name: "Selected user" }],
    });
    const result = await loadEventRecords(db.client, [], { type, id: "selected" });
    const records = type === "invoice" ? result.invoiceResult : type === "vendor" ? result.vendorResult
      : type === "property" ? result.propertyResult : result.profileResult;
    assert.ok(records.data.some((row) => row.id === "selected"));
  }
});

test("missing selections remain absent and an empty unfiltered page runs no name queries", async () => {
  const db = database({});
  await loadEventRecords(db.client, []);
  assert.equal(db.calls.length, 0);
  const result = await loadEventRecords(db.client, [], { type: "vendor", id: "missing" });
  assert.deepEqual(result.vendorResult.data, []);
});

test("lookup failures propagate instead of becoming misleading missing-name labels", async () => {
  const db = database({}, "vendors");
  await assert.rejects(loadEventRecords(db.client, [{ ...emptyIds, vendor_id: "vendor" }]), /Lookup failed/);
});
