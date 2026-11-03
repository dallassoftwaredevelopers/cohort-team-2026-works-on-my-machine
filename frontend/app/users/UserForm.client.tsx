"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveUser } from "./actions";

export type UserProfile = { id: string; name: string };

export default function UserForm({ user }: { user: UserProfile }) {
  const [state, formAction, pending] = useActionState(saveUser, undefined);

  return (
    <form action={formAction} className="card card-body d-grid gap-3">
      <h2 className="h5 mb-0">User details</h2>
      {state?.error && <p role="alert" className="alert alert-danger mb-0">{state.error}</p>}
      <input type="hidden" name="id" value={user.id} />
      <label className="form-label">Name
        <input type="text" name="name" required defaultValue={state?.name ?? user.name} className="form-control mt-1" />
      </label>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="d-flex gap-3">
          <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save changes"}</button>
          <Link href="/users" className="btn btn-outline-secondary">Cancel</Link>
          <Link href={`/events?type=actor&id=${user.id}`} className="btn btn-outline-secondary" title="Actions performed by this user">History</Link>
        </div>
      </div>
    </form>
  );
}
