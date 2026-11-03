"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authorizeMockPayment, cancelMockPayment, startMockPayment } from "./payment-actions";

export default function PaymentAgent({ invoiceId, job }: { invoiceId: string; job: { id: string; state: string; error: string | null; authorization_expires_at: string | null; snapshot: { vendorName: string; accountNumber: string; reference: string; amount: string; propertyName: string } } | null }) {
  const [start, startAction, starting] = useActionState(startMockPayment, undefined);
  const [authorize, authorizeAction, authorizing] = useActionState(authorizeMockPayment, undefined);
  const [cancel, cancelAction, cancelling] = useActionState(cancelMockPayment, undefined);
  const router = useRouter();
  const active = job && ["queued", "preparing", "awaiting_authorization", "authorized", "submitting"].includes(job.state);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [active, router]);
  return <section className="card card-body d-grid gap-3">
    <h2 className="h5">AI mock payment</h2>
    <p className="mb-0">Fictional one-time ACH only. No money moves.</p>
    {job && <><p role="status">Status: <strong>{job.state.replaceAll("_", " ")}</strong></p>
      <dl><dt>Vendor</dt><dd>{job.snapshot.vendorName}</dd><dt>Property</dt><dd>{job.snapshot.propertyName}</dd><dt>Customer account</dt><dd>{job.snapshot.accountNumber}</dd><dt>Invoice</dt><dd>{job.snapshot.reference}</dd><dt>Amount</dt><dd>${job.snapshot.amount} USD</dd></dl>
      {job.error && <p role="alert" className="alert alert-warning">{job.error}</p>}
      {job.state === "needs_review" && <p className="alert alert-warning">The payment outcome is uncertain. Check the portal receipt and history before taking further action. Automatic retries are blocked.</p>}
      {job.state === "awaiting_authorization" && <form action={authorizeAction} className="d-grid gap-3">
        <input type="hidden" name="jobId" value={job.id} />
        <p>The worker verified the bill and populated fictional ACH details. Funding account ends in 6789. Payment fee: $0.00.</p>
        <label><input type="checkbox" name="authorize" required /> I authorize this one-time mock payment for the vendor, account, invoice, and amount shown above.</label>
        <p className="small">Authorization expires at {job.authorization_expires_at ? new Date(job.authorization_expires_at).toUTCString() : "the end of the review window"}.</p>
        <button className="btn btn-primary" disabled={authorizing}>{authorizing ? "Authorizing…" : "Authorize mock payment"}</button>
      </form>}
      {active && job.state !== "submitting" && <form action={cancelAction}><input type="hidden" name="jobId" value={job.id} /><button className="btn btn-outline-secondary" disabled={cancelling}>Cancel preparation</button></form>}
    </>}
    {(!job || ["failed", "cancelled", "expired"].includes(job.state)) && <form action={startAction}><input type="hidden" name="invoiceId" value={invoiceId} /><button className="btn btn-primary" disabled={starting}>{starting ? "Queuing…" : "Prepare mock payment"}</button></form>}
    {[start?.error, authorize?.error, cancel?.error].filter(Boolean).map((error, i) => <p key={i} role="alert" className="alert alert-danger">{error}</p>)}
  </section>;
}
