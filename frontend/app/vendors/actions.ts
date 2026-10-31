"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type FormState = { error: string; values?: Record<string, string> } | undefined;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const account_number = String(formData.get("account_number") ?? "").trim();
  const payment_type = String(formData.get("payment_type") ?? "").trim();
  const autopay = formData.get("autopay") === "on";
  const submitted = { name, account_number, payment_type, autopay: String(autopay) };
  if (!name) return { error: "Enter a vendor name.", values: submitted };
  if (id && !uuid.test(id)) return { error: "Invalid vendor.", values: submitted };

  const values = { name, account_number: account_number || null, payment_type: payment_type || null, autopay };
  const query = id
    ? supabase.from("vendors").update(values).eq("id", id).is("deleted_at", null)
    : supabase.from("vendors").insert(values);
  const { error } = await query.select("id").single();
  if (error) return { error: error.message, values: submitted };

  refresh();
  redirect("/vendors");
}

export async function archiveVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!uuid.test(id)) return { error: "Invalid vendor." };
  const { error } = await supabase
    .from("vendors")
    .update({ deleted_at: new Date().toISOString(), deleted_by: data.claims.sub })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { error: error.message };

  redirect("/vendors");
}
