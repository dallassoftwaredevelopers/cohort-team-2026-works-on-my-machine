import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import UserForm from "../../UserForm.client";

type Props = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditUserPage({ params }: Props) {
  return (
    <div className="mx-auto" style={{ maxWidth: "40rem" }}>
      <header className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Edit user</h1>
          <p className="text-body-secondary mb-0">Update the user profile.</p>
        </div>
        <Link href="/users" className="btn btn-outline-secondary">Back to users</Link>
      </header>
      <Suspense fallback={<p className="text-body-secondary">Loading user…</p>}>
        <UserEditor params={params} />
      </Suspense>
    </div>
  );
}

async function UserEditor({ params }: Props) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect(`/login?next=/users/${id}/edit`);

  const { data: actor, error: actorError } = await supabase.from("profiles")
    .select("role")
    .eq("id", data.claims.sub)
    .single();
  if (actorError) throw actorError;
  if (actor.role !== "admin") redirect("/users");

  const { data: user, error } = await supabase.from("profiles")
    .select("id, name, role")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!user) notFound();

  return <UserForm key={user.id} user={user} />;
}
