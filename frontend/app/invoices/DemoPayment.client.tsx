"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkDemoPayment, resolveDemoPayment, startDemoPayment, type PaymentState, type PaymentView } from "./payment-actions";

async function requestPayment(action: () => Promise<PaymentState>): Promise<PaymentState> {
  try { return await action(); }
  catch { return { error: "Could not contact the server. Reload to check the saved payment attempt before trying again." }; }
}

export default function DemoPayment({ invoiceId, initialAttempt, enabled }: {
  invoiceId: string; initialAttempt: PaymentView | null; enabled: boolean;
}) {
  const router = useRouter();
  const prefix = useId();
  const [state, setState] = useState<PaymentState>({ attempt: initialAttempt ?? undefined });
  const [pending, startTransition] = useTransition();
  const attempt = state.attempt;
  const polling = attempt?.status === "starting" || attempt?.status === "running";

  function accept(next: PaymentState) {
    setState((previous) => ({ ...next, attempt: next.attempt ?? previous.attempt }));
    if (next.attempt?.status === "succeeded") {
      router.push("/invoices");
      router.refresh();
    }
  }

  useEffect(() => {
    if (!polling) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const next = await requestPayment(() => checkDemoPayment(invoiceId));
      if (!active) return;
      setState((previous) => ({ ...next, attempt: next.attempt ?? previous.attempt }));
      if (next.attempt?.status === "succeeded") {
        router.push("/invoices");
        router.refresh();
      } else if (!next.attempt || ["starting", "running"].includes(next.attempt.status)) {
        timer = setTimeout(() => { void poll(); }, next.error ? 15_000 : 5_000);
      }
    }
    timer = setTimeout(() => { void poll(); }, 5_000);
    return () => { active = false; clearTimeout(timer); };
  }, [invoiceId, polling, router]);

  return <section className="card card-body mt-4 d-grid gap-3" aria-labelledby={`${prefix}-title`}>
    <h2 className="h5 mb-0" id={`${prefix}-title`}>Demo payment</h2>
    <p className="small text-body-secondary mb-0">Uses the demo credentials and payment details on the vendor website. Processing continues if you leave this page. A matching confirmation marks this invoice paid automatically.</p>
    {!enabled && <p className="mb-0">Demo payments are not configured on this server.</p>}
    {attempt && <div role="status" aria-live="polite" className={`alert ${attempt.status === "uncertain" ? "alert-warning" : "alert-info"} mb-0`}>
      {attempt.message}
    </div>}
    {state.error && <p role="alert" className="alert alert-danger mb-0">{state.error}</p>}
    {attempt?.run_id && <p className="small mb-0">Browser Use task: <code>{attempt.run_id}</code></p>}
    <div className="d-flex flex-wrap gap-2">
      {(!attempt || attempt.status === "failed") && <button type="button" className="btn btn-primary" disabled={!enabled || pending}
        onClick={() => startTransition(async () => { accept(await requestPayment(() => startDemoPayment(invoiceId))); })}>
        {pending ? "Starting…" : attempt ? "Retry demo payment" : "Run demo payment"}
      </button>}
      {attempt && !["failed", "succeeded"].includes(attempt.status) && <button type="button" className="btn btn-outline-secondary" disabled={pending || !enabled}
        onClick={() => startTransition(async () => { accept(await requestPayment(() => checkDemoPayment(invoiceId))); })}>
        {pending ? "Checking…" : "Check payment status"}
      </button>}
    </div>
    {attempt?.status === "uncertain" && <details>
      <summary>Resolve after checking payment history</summary>
      <form className="d-grid gap-3 mt-3" action={(form) => startTransition(async () => { accept(await requestPayment(() => resolveDemoPayment(invoiceId, form))); })}>
        <p className="mb-0">In Browser Use, confirm the task has finished or stop it. Then check the vendor receipt and history. Enter its confirmation if paid; leave it blank only if you verified no payment occurred.</p>
        <label htmlFor={`${prefix}-confirmation`}>Verified confirmation number (if paid)</label>
        <input id={`${prefix}-confirmation`} name="confirmation" maxLength={200} className="form-control" />
        <label htmlFor={`${prefix}-reason`}>Review note</label>
        <textarea id={`${prefix}-reason`} name="reason" required maxLength={500} className="form-control" />
        <label><input type="checkbox" name="reviewed" required /> I confirmed the task has stopped and checked payment history.</label>
        <div><button className="btn btn-outline-primary" disabled={pending}>Save reviewed outcome</button></div>
      </form>
    </details>}
  </section>;
}
