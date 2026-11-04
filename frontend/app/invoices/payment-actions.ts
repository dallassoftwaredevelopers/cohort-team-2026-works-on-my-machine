"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { portalFor } from "@/lib/payments/policy";
import { invoiceSchema } from "@/lib/payments/types";
import { mockPaymentEnabled } from "@/lib/payments/config";

type State = { error?: string } | undefined;
async function client() {
  if (!mockPaymentEnabled()) throw new Error("Mock payment agent is disabled");
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");
  return db;
}
export async function startMockPayment(_previous: State, form: FormData): Promise<State> {
  let invoiceId: string;
  try {
    invoiceId = z.string().uuid().parse(form.get("invoiceId"));
    const db = await client();
    const { data: invoice, error } = await db.from("invoices").select("id,vendor_id,property_id,reference_number,amount,payment_url,status,vendors(name,account_number),properties(name)").eq("id", invoiceId).is("deleted_at", null).single();
    if (error) throw new Error(error.message);
    // Supabase's ungenerated relationship types can be arrays; validate the final shape at runtime.
    const vendor = Array.isArray(invoice.vendors) ? invoice.vendors[0] : invoice.vendors;
    const property = Array.isArray(invoice.properties) ? invoice.properties[0] : invoice.properties;
    portalFor(invoiceSchema.parse({ id: invoice.id, vendorId: invoice.vendor_id, propertyId: invoice.property_id, reference: invoice.reference_number, amount: String(invoice.amount), paymentUrl: invoice.payment_url, status: invoice.status, vendorName: vendor?.name, accountNumber: vendor?.account_number, propertyName: property?.name }));
    const result = await db.rpc("start_mock_payment_agent", { p_invoice_id: invoiceId });
    if (result.error) throw new Error(result.error.message);
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not start mock payment" }; }
  redirect(`/invoices/${invoiceId}/payment`);
}
export async function authorizeMockPayment(_previous: State, form: FormData): Promise<State> {
  try {
    const jobId = z.string().uuid().parse(form.get("jobId"));
    if (form.get("authorize") !== "on") throw new Error("Explicit authorization is required");
    const db = await client();
    const { error } = await db.rpc("authorize_mock_payment_agent", { p_job_id: jobId });
    if (error) throw new Error(error.message);
    refresh();
    return {};
  } catch (error) { return { error: error instanceof Error ? error.message : "Authorization failed" }; }
}
export async function cancelMockPayment(_previous: State, form: FormData): Promise<State> {
  try {
    const db = await client();
    const { error } = await db.rpc("cancel_mock_payment_agent", { p_job_id: z.string().uuid().parse(form.get("jobId")) });
    if (error) throw new Error(error.message);
    refresh(); return {};
  } catch (error) { return { error: error instanceof Error ? error.message : "Cancellation failed" }; }
}
