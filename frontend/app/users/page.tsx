import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ClickableTableRow from "@/components/ClickableTableRow.client";
import { isUserRole, userRoleLabels } from "@/lib/users/roles";

export default function UsersPage() {
  return (
    <>
      <header className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Users</h1>
          <p className="text-body-secondary mb-0">View and update user profiles.</p>
        </div>
        <Link href="/users/new" className="btn btn-primary">Add user</Link>
      </header>

      <Suspense fallback={<p className="text-body-secondary">Loading users…</p>}>
        <UserTable />
      </Suspense>
    </>
  );
}

async function UserTable() {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect("/login?next=/users");

  const { data: actor, error: actorError } = await supabase.from("profiles")
    .select("role")
    .eq("id", data.claims.sub)
    .single();
  if (actorError) throw actorError;
  if (actor.role !== "admin") return <p role="alert" className="alert alert-warning">Only admins can manage users.</p>;

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, name, role")
    .order("name");
  if (error) throw error;

  return (
    <div className="border rounded-3 bg-body overflow-hidden">
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th scope="col" className="small text-uppercase text-body-secondary ps-3">User</th>
              <th scope="col" className="small text-uppercase text-body-secondary pe-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={2} className="p-4 text-body-secondary">No users yet.</td>
              </tr>
            )}
            {users.map((user) => (
              <ClickableTableRow key={user.id} href={`/users/${user.id}/edit`}>
                <td className="fw-medium ps-3">
                  <Link href={`/users/${user.id}/edit`} className="text-body text-decoration-none" aria-label={`Edit ${user.name}`}>
                    {user.name}
                  </Link>
                </td>
                <td className="pe-3">{user.role && isUserRole(user.role) ? userRoleLabels[user.role] : user.role || "—"}</td>
              </ClickableTableRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
