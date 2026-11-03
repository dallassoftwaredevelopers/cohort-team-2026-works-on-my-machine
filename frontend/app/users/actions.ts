"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type UserFormState = { error: string; name: string } | undefined;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!uuid.test(id)) return { error: "Invalid user.", name };
  if (!name) return { error: "Enter a user name.", name };

  const { data: actor, error: actorError } = await supabase.from("profiles")
    .select("role")
    .eq("id", data.claims.sub)
    .single();
  if (actorError || actor?.role !== "admin") return { error: "Only admins can edit users.", name };

  const { error } = await supabase.from("profiles")
    .update({ name })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return { error: error.message, name };

  revalidatePath("/users");
  revalidatePath(`/users/${id}/edit`);
  refresh();
  redirect("/users");
}
