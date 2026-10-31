"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type FormState = { error: string; values?: Record<string, string> } | undefined;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) return { error: "Enter a property name.", values: { name, address } };
  if (id && !uuid.test(id)) return { error: "Invalid property.", values: { name, address } };

  const values = { name, address: address || null };
  const query = id
    ? supabase.from("properties").update(values).eq("id", id).is("deleted_at", null)
    : supabase.from("properties").insert(values);
  const { error } = await query.select("id").single();
  if (error) return { error: error.message, values: { name, address } };


  if (id) redirect("/properties");
  refresh();
}

export async function archiveProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!uuid.test(id)) return { error: "Invalid property." };
  const { error } = await supabase
    .from("properties")
    .update({ deleted_at: new Date().toISOString(), deleted_by: data.claims.sub })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { error: error.message };

  redirect("/properties");
}
