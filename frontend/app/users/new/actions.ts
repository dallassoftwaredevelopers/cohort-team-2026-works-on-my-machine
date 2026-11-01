"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";


export type CreateUserState =
  | { error: string; values: { name: string; email: string } }
  | { created: { email: string; needsConfirmation: boolean } }
  | undefined;

export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const { data: actor, error: actorError } = await supabase.from("profiles")
    .select("role")
    .eq("id", data.claims.sub)
    .single();
  if (actorError || actor?.role !== "admin") return { error: "Only admins can add users.", values: { name: "", email: "" } };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const values = { name, email };
  if (!name) return { error: "Enter a name.", values };
  if (password !== confirmPassword) return { error: "Passwords do not match.", values };

  const stateless = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data: signUp, error } = await stateless.auth.signUp({
    email, password, options: { data: { name } },
  });
  if (error) return { error: error.message, values };

  return { created: { email, needsConfirmation: !signUp.session } };
}
