"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveProperty } from "./actions";

export type Property = { id: string; name: string; address: string | null };


export default function PropertyForm({ property }: { property?: Property }) {
  const [state, formAction, pending] = useActionState(saveProperty, undefined);
  const values = state?.values ?? { name: property?.name ?? "", address: property?.address ?? "" };

  return (
    <form action={formAction} className="card card-body d-grid gap-3">
      <h2 className="h4">{property ? "Edit property" : "Add a property"}</h2>
      {state?.error && <p role="alert" className="alert alert-danger mb-0">{state.error}</p>}
      {property && <input type="hidden" name="id" value={property.id} />}
      <label className="form-label">Name
        <input type="text" name="name" required defaultValue={values.name} className="form-control mt-1" />
      </label>
      <label className="form-label">Address <span className="text-body-secondary">(optional)</span>
        <input type="text" name="address" defaultValue={values.address} className="form-control mt-1" />
      </label>
      <div className="d-flex gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : property ? "Save changes" : "Add property"}</button>
        {property && <Link href="/properties" className="btn btn-outline-secondary">Cancel</Link>}
      </div>
    </form>
  );
}
