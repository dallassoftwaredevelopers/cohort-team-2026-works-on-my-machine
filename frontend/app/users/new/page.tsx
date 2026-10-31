import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CreateUserForm from "./CreateUserForm.client";

export default function CreateUserPage() {
  return (
    <div className="mx-auto" style={{ maxWidth: "40rem" }}>
      <header className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Add user</h1>
          <p className="text-body-secondary mb-0">Create an account for a new user.</p>
        </div>
        <Link href="/users" className="btn btn-outline-secondary">Back to users</Link>
      </header>
      <Suspense fallback={<p className="text-body-secondary">Loading…</p>}>
        <CreateUser />
      </Suspense>
    </div>
  );
}

async function CreateUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?next=/users/new");

  const { data: actor, error } = await supabase.from("profiles")
    .select("role")
    .eq("id", data.claims.sub)
    .single();
  if (error) throw error;
  if (actor.role !== "admin") return <p role="alert" className="alert alert-warning">Only admins can add users.</p>;

  return <CreateUserForm />;
}
