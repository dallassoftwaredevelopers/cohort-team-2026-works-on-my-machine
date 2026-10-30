import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import VendorRow from "./VendorRow.client";

export default function VendorsPage() {
  return (
    <>
      <header className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Utility vendors</h1>
          <p className="text-body-secondary mb-0">Manage the vendors available when entering invoices.</p>
        </div>
        <Link href="/vendors/new" className="btn btn-primary">Add vendor</Link>
      </header>

      <Suspense fallback={<p className="text-body-secondary">Loading vendors…</p>}>
        <VendorTable />
      </Suspense>
    </>
  );
}

async function VendorTable() {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect("/login?next=/vendors");

  const { data: vendors, error } = await supabase
    .from("vendors")
    .select("id, name, account_number, payment_type, autopay")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;

  return (
    <div className="border rounded-3 bg-body overflow-hidden">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col" className="small text-uppercase text-body-secondary ps-3">Vendor</th>
              <th scope="col" className="small text-uppercase text-body-secondary">Account number</th>
              <th scope="col" className="small text-uppercase text-body-secondary">Payment type</th>
              <th scope="col" className="small text-uppercase text-body-secondary pe-3">Autopay</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-body-secondary">No vendors yet. Add one to use it on invoices.</td>
              </tr>
            )}
            {vendors.map((vendor) => (
              <VendorRow key={vendor.id} href={`/vendors/${vendor.id}/edit`}>
                <td className="fw-medium ps-3"><Link href={`/vendors/${vendor.id}/edit`} className="text-body text-decoration-none" aria-label={`Edit ${vendor.name}`}>{vendor.name}</Link></td>
                <td>{vendor.account_number || "—"}</td>
                <td>{vendor.payment_type || "—"}</td>
                <td className="pe-3"><span style={{ width: "3rem" }} className={`badge rounded-pill ${vendor.autopay ? "bg-success-subtle text-success-emphasis" : "bg-secondary-subtle text-secondary-emphasis"}`}>{vendor.autopay ? "On" : "Off"}</span></td>
              </VendorRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
