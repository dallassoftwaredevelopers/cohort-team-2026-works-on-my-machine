import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ArchiveButton from "@/components/ArchiveButton.client";
import { archiveProperty } from "./actions";
import PropertyForm from "./PropertyForm.client";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default function PropertiesPage({ searchParams }: Props) {
  return (
    <div className="mx-auto" style={{ maxWidth: "48rem" }}>
      <header className="mb-4">
        <div>
          <p className="mb-1 small fw-semibold text-uppercase text-body-secondary">Property management</p>
          <h1>Properties</h1>
        </div>
      </header>

      <Suspense fallback={<p className="text-body-secondary">Loading properties…</p>}>
        <Properties searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Properties({ searchParams }: Props) {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect("/login?next=/properties");

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name, address")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;

  const { edit } = await searchParams;
  const editing = properties.find((property) => property.id === edit);

  return (
    <div className="d-grid gap-4">
      <PropertyForm key={editing?.id ?? "new"} property={editing} />

      <section aria-labelledby="property-list-title">
        <h2 id="property-list-title" className="h4 mb-3">Saved properties</h2>
        {properties.length === 0 ? (
          <p className="card card-body text-body-secondary">No properties yet. Add one above.</p>
        ) : (
          <ul className="list-group">
            {properties.map((property) => <li key={property.id} className="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <p className="fw-medium mb-0">{property.name}</p>
                {property.address && <p className="small text-body-secondary mb-0">{property.address}</p>}
              </div>
              <div className="d-flex align-items-center gap-2">
                <Link href={{ pathname: "/properties", query: { edit: property.id } }} className="btn btn-outline-secondary">Edit</Link>
                <ArchiveButton action={archiveProperty} id={property.id} name={property.name} />
              </div>
            </li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
