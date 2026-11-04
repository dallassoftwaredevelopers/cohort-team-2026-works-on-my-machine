import "server-only";
import { createClient } from "@supabase/supabase-js";

export function paymentWorkerConfigured() {
  return Boolean(process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

// Background steps have no browser session. Keep elevated access in this module;
// settlement is restricted to the service-role-only RPC and a saved attempt ID.
export function createPaymentWorkerClient() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new Error("Configure SUPABASE_SECRET_KEY on the server to enable background payments.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
