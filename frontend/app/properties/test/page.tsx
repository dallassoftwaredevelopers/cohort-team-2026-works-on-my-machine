// Reference pattern: keep the page static, and fetch inside a <Suspense>-wrapped Server Component
// with the server Supabase client, then pass the data to a small client component only for interactivity.
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import PropertySelect from "./PropertySelect.client";

export default function PropertiesTestPage() {
  return (
    <Suspense fallback={<p>Loading properties…</p>}>
      <Properties />
    </Suspense>
  );
}

async function Properties() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return <p><Link href="/login?next=/properties/test">Sign in to view properties</Link></p>;
  }

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;

  return <PropertySelect properties={properties ?? []} />;
}
