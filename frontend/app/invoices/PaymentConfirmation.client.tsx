"use client";

import { useActionState, useId } from "react";
import { savePaymentConfirmation } from "./actions";

export default function PaymentConfirmation({ invoiceId, confirmation, readOnly = false }: { invoiceId: string; confirmation: string | null; readOnly?: boolean }) {
  const [state, action, pending] = useActionState(savePaymentConfirmation, undefined);
  const id = useId();
  if (readOnly) return <section className="card card-body mt-4">
    <h2 className="h5">Payment confirmation</h2>
    <p className="mb-0">{confirmation || "No confirmation recorded."}</p>
  </section>;
  return <form action={action} className="card card-body mt-4 d-grid gap-3">
    <h2 className="h5 mb-0">Payment confirmation</h2>
    <input type="hidden" name="id" value={invoiceId} />
    <label htmlFor={id}>Confirmation number</label>
    <input id={id} name="confirmation" required maxLength={200} defaultValue={state?.value ?? confirmation ?? ""} className="form-control" />
    {state?.error && <p role="alert" className="alert alert-danger mb-0">{state.error}</p>}
    <p className="small text-body-secondary mb-0">Saving this number marks the invoice paid and removes it from active invoices.</p>
    <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save confirmation and mark paid"}</button></div>
  </form>;
}
