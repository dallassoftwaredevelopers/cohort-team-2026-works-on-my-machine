"use server";

import { refresh } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { isInvoiceStatus, type InvoiceStatus } from "@/lib/invoices/status";

export type InvoiceInput = {
  date: string;
  vendorId: string;
  propertyId: string;
  invoiceNumber: string;
  amountDue: string;
  dueDate: string;
  paymentUrl: string;
  status: InvoiceStatus;
};

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function validatedInvoice(input: Omit<InvoiceInput, "date">): { error: string } | { values: {
  reference_number: string;
  vendor_id: string;
  property_id: string;
  amount: number;
  due_date: string;
  payment_url: string | null;
  status: InvoiceStatus;
} } {
  if (!input || typeof input.invoiceNumber !== "string" || typeof input.amountDue !== "string"
    || typeof input.vendorId !== "string" || typeof input.propertyId !== "string"
    || typeof input.dueDate !== "string" || typeof input.paymentUrl !== "string") {
    return { error: "Invalid invoice details." };
  }
  const invoiceNumber = input.invoiceNumber.trim();
  const paymentUrl = input.paymentUrl.trim();
  const amount = Number(input.amountDue);
  if (!uuid.test(input.vendorId) || !uuid.test(input.propertyId)) return { error: "Choose a vendor and a property." };
  if (!invoiceNumber) return { error: "Enter an invoice number." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount greater than 0." };
  if (!isoDate.test(input.dueDate)) return { error: "Enter a due date." };
  if (paymentUrl && !isUrl(paymentUrl)) return { error: "Enter a valid payment URL." };
  if (!isInvoiceStatus(input.status)) return { error: "Choose a valid status." };

  return { values: {
    reference_number: invoiceNumber,
    vendor_id: input.vendorId,
    property_id: input.propertyId,
    amount,
    due_date: input.dueDate,
    payment_url: paymentUrl || null,
    status: input.status,
  } };
}

async function activeReferences(supabase: Awaited<ReturnType<typeof createClient>>, vendorId: string, propertyId: string) {
  return Promise.all([
    supabase.from("vendors").select("id").eq("id", vendorId).is("deleted_at", null).maybeSingle(),
    supabase.from("properties").select("id").eq("id", propertyId).is("deleted_at", null).maybeSingle(),
  ]);
}

export async function createInvoice(input: InvoiceInput): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const validated = validatedInvoice(input);
  if ("error" in validated) return validated;
  if (typeof input.date !== "string" || !isoDate.test(input.date)) return { error: "Invalid invoice date." };

  const [vendor, property] = await activeReferences(supabase, validated.values.vendor_id, validated.values.property_id);
  if (vendor.error) return { error: vendor.error.message };
  if (property.error) return { error: property.error.message };
  if (!vendor.data || !property.data) return { error: "Choose an active vendor and property." };

  const { error } = await supabase.from("invoices").insert({
    ...validated.values,
    date: input.date,
  });
  if (error) return { error: `Could not save invoice: ${error.message}` };
  refresh();
}

export async function updateInvoice(id: string, input: Omit<InvoiceInput, "date">): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");
  if (typeof id !== "string" || !uuid.test(id)) return { error: "Invalid invoice." };

  const validated = validatedInvoice(input);
  if ("error" in validated) return validated;

  const { data: current, error: currentError } = await supabase.from("invoices")
    .select("vendor_id, property_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (currentError) return { error: currentError.message };
  if (!current) return { error: "Invoice not found or archived." };

  const [vendor, property] = await activeReferences(supabase, validated.values.vendor_id, validated.values.property_id);
  if (vendor.error) return { error: vendor.error.message };
  if (property.error) return { error: property.error.message };
  if (!vendor.data && validated.values.vendor_id !== current.vendor_id) return { error: "Choose an active vendor." };
  if (!property.data && validated.values.property_id !== current.property_id) return { error: "Choose an active property." };

  const { error } = await supabase.from("invoices")
    .update(validated.values)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { error: `Could not save invoice: ${error.message}` };
  refresh();
}

export async function archiveInvoice(_prev: { error: string } | undefined, formData: FormData): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!uuid.test(id)) return { error: "Invalid invoice." };

  const { error } = await supabase.from("invoices")
    .update({ deleted_at: new Date().toISOString(), deleted_by: data.claims.sub })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { error: error.message };

  refresh();
}
