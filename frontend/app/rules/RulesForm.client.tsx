"use client";

import { useActionState } from "react";
import { saveRules, type RuleValues } from "./actions";

type Settings = {
  max_auto_approval_amount: number | null;
  max_above_average_percent: number | null;
  min_comparable_bills: number | null;
};

export default function RulesForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(saveRules, undefined);
  const values: RuleValues = state?.values ?? {
    max_auto_approval_amount: settings.max_auto_approval_amount?.toString() ?? "",
    max_above_average_percent: settings.max_above_average_percent?.toString() ?? "",
    min_comparable_bills: settings.min_comparable_bills?.toString() ?? "",
  };
  const configured = Object.values(settings).every((value) => value !== null);

  return (
    <form action={formAction} className="card card-body d-grid gap-4">
      <div>
        <h2 className="h5 mb-1">Automatic approval settings</h2>
        <p className="text-body-secondary mb-0">New invoices for autopay vendors are approved when all three checks pass. Other invoices wait for approval.</p>
      </div>
      {!configured && <p role="status" className="alert alert-info mb-0">Approval thresholds have not been configured.</p>}
      {state?.error && <p role="alert" className="alert alert-danger mb-0">{state.error}</p>}
      {state?.success && <p role="status" className="alert alert-success mb-0">Approval rules saved.</p>}

      <div>
        <label htmlFor="max-auto-approval-amount" className="form-label mb-0">Amount limit</label>
        <p className="small text-body-secondary mb-1">Maximum invoice amount eligible for automatic approval.</p>
        <div className="input-group mt-1">
          <span className="input-group-text">$</span>
          <input id="max-auto-approval-amount" type="number" name="max_auto_approval_amount" min="0.01" max="9999999999.99" step="0.01" required disabled={pending}
            defaultValue={values.max_auto_approval_amount} className="form-control" />
        </div>
      </div>
      <div>
        <label htmlFor="max-above-average-percent" className="form-label mb-0">Unusual amount</label>
        <p className="small text-body-secondary mb-1">Maximum percentage above the average of prior bills.</p>
        <div className="input-group mt-1">
          <input id="max-above-average-percent" type="number" name="max_above_average_percent" min="0" max="99999.99" step="0.01" required disabled={pending}
            defaultValue={values.max_above_average_percent} className="form-control" />
          <span className="input-group-text">%</span>
        </div>
      </div>
      <label className="form-label mb-0">Short history
        <span className="d-block small text-body-secondary">Minimum number of comparable prior bills.</span>
        <input type="number" name="min_comparable_bills" min="1" max="2147483647" step="1" required disabled={pending}
          defaultValue={values.min_comparable_bills} className="form-control mt-1" />
      </label>

      <div><button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save rules"}</button></div>
    </form>
  );
}
