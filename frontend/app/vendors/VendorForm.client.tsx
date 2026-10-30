"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { archiveVendor, saveVendor } from "./actions";
import ArchiveButton from "@/components/ArchiveButton.client";

export type Vendor = { id: string; name: string; account_number: string | null; payment_type: string | null; autopay: boolean };

export default function VendorForm({ vendor }: { vendor?: Vendor }) {
  const formId = useId();
  const [state, formAction, pending] = useActionState(saveVendor, undefined);
  const values = state?.values ?? { name: vendor?.name ?? "", account_number: vendor?.account_number ?? "", payment_type: vendor?.payment_type ?? "", autopay: String(vendor?.autopay ?? false) };

  return (
    <div className="card card-body d-grid gap-3">
    <form id={formId} action={formAction} className="d-grid gap-3">
      <h2 className="h5 mb-0">Vendor details</h2>
      {state?.error && <p role="alert" className="alert alert-danger mb-0">{state.error}</p>}
      {vendor && <input type="hidden" name="id" value={vendor.id} />}
      <label className="form-label">Name
        <input type="text" name="name" required defaultValue={values.name} className="form-control mt-1" />
      </label>
      <label className="form-label">Account number <span className="text-body-secondary">(optional)</span>
        <input type="text" name="account_number" defaultValue={values.account_number} className="form-control mt-1" />
      </label>
      <label className="form-label">Payment type <span className="text-body-secondary">(optional)</span>
        <input type="text" name="payment_type" defaultValue={values.payment_type} className="form-control mt-1" />
      </label>
      <div className="form-check form-switch">
        <input type="checkbox" role="switch" name="autopay" id={`${formId}-autopay`} defaultChecked={values.autopay === "true"} className="form-check-input" />
        <label className="form-check-label" htmlFor={`${formId}-autopay`}>Autopay</label>
      </div>
    </form>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="d-flex gap-3">
        <button type="submit" form={formId} disabled={pending} className="btn btn-primary">{pending ? "Saving…" : vendor ? "Save changes" : "Add vendor"}</button>
        <Link href="/vendors" className="btn btn-outline-secondary">Cancel</Link>
        </div>
        {vendor && <ArchiveButton action={archiveVendor} id={vendor.id} name={vendor.name} />}
      </div>
    </div>
  );
}
