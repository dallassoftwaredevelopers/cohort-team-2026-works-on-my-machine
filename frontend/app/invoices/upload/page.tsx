import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { InvoiceFormClient } from "../InvoiceForm.client";
import styles from "./upload.module.scss";

export default function Page() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.pageEyebrow}>Utility Bill Pay</p>
          <h1 className={styles.pageTitle}>New invoice</h1>
        </div>
        <Link href="/invoices" className={styles.backLink}>
          Back to invoices
        </Link>
      </header>
      <Suspense fallback={<p className="text-body-secondary">Loading vendors and properties…</p>}>
        <Uploader />
      </Suspense>
    </div>
  );
}

async function Uploader() {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect("/login?next=/invoices/upload");

  const [vendorResult, propertyResult] = await Promise.all([
    supabase.from("vendors").select("id, name, account_number").is("deleted_at", null).order("name"),
    supabase.from("properties").select("id, name").is("deleted_at", null).order("name"),
  ]);
  if (vendorResult.error) throw vendorResult.error;
  if (propertyResult.error) throw propertyResult.error;

  return <InvoiceFormClient vendors={vendorResult.data} properties={propertyResult.data} />;
}
