"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isUserRole } from "@/lib/users/roles";

export type UserFormState = { error: string; name: string; role: string } | undefined;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  if (!uuid.test(id)) return { error: "Invalid user.", name, role };
  if (!name) return { error: "Enter a user name.", name, role };
  if (!isUserRole(role)) return { error: "Choose a valid role.", name, role };

  const { data: actor, error: actorError } = await supabase.from("profiles")
    .select("role")
    .eq("id", data.claims.sub)
    .single();
  if (actorError || actor?.role !== "admin") return { error: "Only admins can edit users.", name, role };

  const { error } = await supabase.from("profiles")
    .update({ name, role })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return { error: error.message, name, role };

  refresh();
  redirect("/users");
}
