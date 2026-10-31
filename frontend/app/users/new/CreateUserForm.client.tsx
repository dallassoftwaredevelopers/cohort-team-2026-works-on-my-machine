"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createUser } from "./actions";

export default function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUser, undefined);
  const values = state && "values" in state ? state.values : undefined;

  return (
    <form action={formAction} className="card card-body d-grid gap-3">
      <h2 className="h5 mb-0">User details</h2>
      {state && "error" in state && <p role="alert" className="alert alert-danger mb-0">{state.error}</p>}
      {state && "created" in state && <p role="status" className="alert alert-success mb-0">
        Created {state.created.email}.
        {state.created.needsConfirmation && " They need to follow the confirmation link sent to that address before signing in."}
      </p>}
      <label className="form-label">Name
        <input type="text" name="name" required autoComplete="off" defaultValue={values?.name} className="form-control mt-1" />
      </label>
      <label className="form-label">Email
        <input type="email" name="email" required autoComplete="off" defaultValue={values?.email} className="form-control mt-1" />
      </label>
      <label className="form-label">Password
        <input type="password" name="password" required minLength={6} autoComplete="new-password" className="form-control mt-1" />
      </label>
      <label className="form-label">Confirm password
        <input type="password" name="confirmPassword" required minLength={6} autoComplete="new-password" className="form-control mt-1" />
      </label>
      <div className="d-flex gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Creating user…" : "Add user"}</button>
        <Link href="/users" className="btn btn-outline-secondary">Cancel</Link>
      </div>
    </form>
  );
}
