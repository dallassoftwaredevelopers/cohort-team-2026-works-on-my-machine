import { createClient } from "@/utils/supabase/server";

type InvoiceMatch = {
  id: string;
  reference_number: string;
  deleted_at: string | null;
  vendor: { name: string } | null;
  property: { name: string } | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError || !data?.claims) return Response.json({ error: "Sign in to search activity records." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const query = (params.get("q") ?? "").trim();
  if (!type || !["invoice", "vendor", "property", "actor"].includes(type) || query.length > 100) {
    return Response.json({ error: "Invalid search." }, { status: 400 });
  }
  if (query.length < 2) return Response.json({ options: [] });
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;

  if (type === "invoice") {
    const result = await supabase.from("invoices")
      .select("id, reference_number, deleted_at, vendor:vendors!inner(name), property:properties(name)")
      .ilike("vendor.name", pattern).order("reference_number").order("id").limit(20);
    if (result.error) return Response.json({ error: "Could not search invoices." }, { status: 500 });
    const rows = result.data as unknown as InvoiceMatch[];
    return Response.json({ options: rows.map((row) => ({
      id: row.id,
      label: `${row.vendor?.name ?? "Unknown vendor"} ${row.reference_number} for ${row.property?.name ?? "Unknown property"}${row.deleted_at ? " (archived)" : ""}`,
    })) });
  }

  const table = type === "actor" ? "profiles" : type === "vendor" ? "vendors" : "properties";
  if (type === "actor") {
    const result = await supabase.from("profiles").select("id, name")
      .ilike("name", pattern).order("name").order("id").limit(20);
    if (result.error) return Response.json({ error: "Could not search users." }, { status: 500 });
    return Response.json({ options: result.data.map((row) => ({ id: row.id, label: row.name })) });
  }
  const result = await supabase.from(table).select("id, name, deleted_at")
    .ilike("name", pattern).order("name").order("id").limit(20);
  if (result.error) return Response.json({ error: "Could not search records." }, { status: 500 });
  return Response.json({ options: result.data.map((row) => ({
    id: row.id, label: `${row.name}${row.deleted_at ? " (archived)" : ""}`,
  })) });
}
