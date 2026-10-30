import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CCard, CCardBody, CCardHeader } from "@coreui/react";
import { createClient } from "@/utils/supabase/server";
import { InvoiceFormClient } from "../InvoiceForm.client";
import styles from "./upload.module.scss";

export default function Page() {
  return (
    <CCard className={styles.uploader}>
      <CCardHeader className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <h1 className="h3 mb-1">New Invoice</h1>
          <p className="mb-0 text-body-secondary">
            Preview an invoice file and enter its details.
          </p>
        </div>
        <Link href="/invoices" className="btn btn-primary">
          View All Invoices
        </Link>
      </CCardHeader>
      <CCardBody>
        <Suspense fallback={<p className="text-body-secondary">Loading vendors and properties…</p>}>
          <Uploader />
        </Suspense>
      </CCardBody>
    </CCard>
  );
}

async function Uploader() {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect("/login?next=/invoices/upload");

  const [vendorResult, propertyResult] = await Promise.all([
    supabase.from("vendors").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("properties").select("id, name").is("deleted_at", null).order("name"),
  ]);
  if (vendorResult.error) throw vendorResult.error;
  if (propertyResult.error) throw propertyResult.error;

  return <InvoiceFormClient vendors={vendorResult.data} properties={propertyResult.data} />;
}
