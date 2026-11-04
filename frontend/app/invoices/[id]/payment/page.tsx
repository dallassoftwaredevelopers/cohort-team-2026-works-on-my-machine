import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import PaymentAgent from "../../PaymentAgent.client";
import { invoiceSchema } from "@/lib/payments/types";
import { mockPaymentEnabled } from "@/lib/payments/config";

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  return <div className="container py-4"><h1>Mock payment agent</h1><Suspense fallback={<p>Loading payment…</p>}><Payment params={params} /></Suspense></div>;
}
async function Payment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims) redirect(`/login?next=/invoices/${id}/payment`);
  if (!mockPaymentEnabled()) return <p>The mock payment agent is disabled.</p>;
  const invoice = await db.from("invoices").select("id,status").eq("id", id).is("deleted_at", null).maybeSingle();
  if (invoice.error) throw new Error(invoice.error.message);
  if (!invoice.data) notFound();
  const result = await db.from("payment_agent_jobs").select("id,state,error,snapshot,confirmation,authorization_expires_at").eq("invoice_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  const job = result.data ? { ...result.data, snapshot: invoiceSchema.parse(result.data.snapshot) } : null;
  const steps = job ? await db.from("payment_agent_steps").select("id,occurred_at,event").eq("job_id", job.id).order("id", { ascending: false }).limit(100) : { data: [], error: null };
  if (steps.error) throw new Error(steps.error.message);
  return <div className="d-grid gap-3"><Link href={`/invoices/${id}/edit`}>Back to invoice</Link>
    {invoice.data.status === "approved" || job ? <PaymentAgent invoiceId={id} job={job} /> : <p>Only approved invoices can be prepared for payment.</p>}
    {result.data?.confirmation && <section className="card card-body"><h2 className="h5">Verified confirmation</h2><pre>{JSON.stringify(result.data.confirmation, null, 2)}</pre></section>}
    <section className="card card-body"><h2 className="h5">Execution history</h2>{steps.data?.map(step => <div key={step.id}><time>{step.occurred_at}</time><pre className="text-wrap">{JSON.stringify(step.event, null, 2)}</pre></div>)}</section>
  </div>;
}
