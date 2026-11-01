import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import VendorForm from "../../VendorForm.client";

type Props = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditVendorPage({ params }: Props) {
  return (
    <div className="mx-auto" style={{ maxWidth: "40rem" }}>
      <header className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Edit vendor</h1>
          <p className="text-body-secondary mb-0">Update the vendor details.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link href="/vendors" className="btn btn-outline-secondary">Back to vendors</Link>
          <Suspense fallback={null}><VendorHistoryLink params={params} /></Suspense>
        </div>
      </header>
      <Suspense fallback={<p className="text-body-secondary">Loading vendor…</p>}>
        <VendorEditor params={params} />
      </Suspense>
    </div>
  );
}

async function VendorHistoryLink({ params }: Props) {
  const { id } = await params;
  if (!uuid.test(id)) return null;
  return <Link href={`/events?type=vendor&id=${id}`} className="btn btn-outline-secondary">History</Link>;
}

async function VendorEditor({ params }: Props) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect(`/login?next=/vendors/${id}/edit`);

  const { data: vendor, error } = await supabase.from("vendors")
    .select("id, name, account_number, payment_type, autopay")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!vendor) notFound();

  return <VendorForm key={vendor.id} vendor={vendor} />;
}
