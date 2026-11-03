"use client";

import { useActionState, useId, useRef } from "react";
import Link from "next/link";
import ArchiveButton from "@/components/ArchiveButton.client";
import type { InvoiceStatus } from "@/lib/invoices/status";
import { archiveInvoice, reopenInvoice } from "./actions";
import styles from "./invoice-form.module.scss";

export default function InvoiceMoreActions({ id, name, status }: { id: string; name: string; status: InvoiceStatus }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reasonId = useId();
  const [state, action, pending] = useActionState(reopenInvoice, undefined);

  return <>
    <details ref={menu} className={styles.moreActions}>
      <summary className="btn btn-outline-secondary">More actions</summary>
      <div className={styles.moreActionsMenu}>
        <Link href={`/events?type=invoice&id=${id}`} className="btn btn-outline-secondary">History</Link>
        {status === "approved" && <button type="button" className="btn btn-outline-secondary" onClick={() => {
          if (menu.current) menu.current.open = false;
          dialog.current?.showModal();
        }}>Reopen for correction</button>}
        {status !== "paid" && <ArchiveButton action={archiveInvoice} id={id} name={name} />}
      </div>
    </details>

    <dialog ref={dialog} aria-labelledby={titleId} className={styles.reopenDialog}>
      <form action={action} className="d-grid gap-3">
        <h2 id={titleId} className="h5 mb-0">Reopen invoice for correction</h2>
        <p className="mb-0">This invoice will return to waiting on approval. Correct and save its details, then approve it again when ready.</p>
        <input type="hidden" name="id" value={id} />
        <label htmlFor={reasonId}>Reason for reopening</label>
        <textarea id={reasonId} name="reason" required maxLength={500} rows={3} defaultValue={state?.reason ?? ""} className="form-control" />
        {state?.error && <p role="alert" className="alert alert-danger mb-0">{state.error}</p>}
        <div className="d-flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Reopening…" : "Reopen invoice"}</button>
          <button type="button" disabled={pending} className="btn btn-outline-secondary" onClick={() => dialog.current?.close()}>Cancel</button>
        </div>
      </form>
    </dialog>
  </>;
}
