import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import VendorForm from "../VendorForm.client";

export default function NewVendorPage() {
  return (
    <div className="mx-auto" style={{ maxWidth: "40rem" }}>
      <header className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Add vendor</h1>
          <p className="text-body-secondary mb-0">Enter the vendor details for future invoices.</p>
        </div>
        <Link href="/vendors" className="btn btn-outline-secondary">Back to vendors</Link>
      </header>
      <Suspense fallback={<p className="text-body-secondary">Loading form…</p>}>
        <NewVendorForm />
      </Suspense>
    </div>
  );
}

async function NewVendorForm() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  if (!data?.claims) redirect("/login?next=/vendors/new");
  return <VendorForm />;
}
