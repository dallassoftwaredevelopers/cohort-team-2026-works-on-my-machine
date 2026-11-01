
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Dashboard from "@/components/Dashboard.client";

type InvoiceRow = {
  id: string;
  reference_number: string;
  amount: number;
  due_date: string | null;
  status: string;
  vendor: { name: string } | null;
  property: { name: string } | null;
};

function getBusinessDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Chicago",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getGreeting(date: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Chicago",
    }).format(date)
  );

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-4 text-body-secondary">
          Loading dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const supabase = await createClient();

  // Authenticate the logged-in user
  const { data, error: authError } =
    await supabase.auth.getClaims();

  if (
    authError &&
    authError.name !== "AuthSessionMissingError"
  ) {
    throw authError;
  }

  if (!data?.claims) {
    redirect("/login?next=/");
  }

  // Fetch the logged-in user's profile
  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("name")
      .eq("id", data.claims.sub)
      .maybeSingle();

  if (profileError) throw profileError;

  const firstName =
    profile?.name?.trim().split(/\s+/)[0] || "there";

  // Retrieve live invoice data from Supabase
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      "id, reference_number, amount, due_date, status, vendor:vendors(name), property:properties(name)"
    )
    .is("deleted_at", null)
    .order("due_date", { ascending: true })
    .overrideTypes<InvoiceRow[], { merge: false }>();

  if (error) throw error;

  const invoiceList = invoices ?? [];

  // Calculate current business date
  const now = new Date();
  const today = getBusinessDate(now);

  const sevenDaysLater = new Date(`${today}T00:00:00Z`);
  sevenDaysLater.setUTCDate(
    sevenDaysLater.getUTCDate() + 7
  );

  const endDate = sevenDaysLater
    .toISOString()
    .slice(0, 10);

  // Calculate invoice status counts
  const needsReview = invoiceList.filter(
    (invoice) => invoice.status === "created"
  ).length;

  const awaitingApproval = invoiceList.filter(
    (invoice) =>
      invoice.status === "waiting on approval"
  ).length;

  const paid = invoiceList.filter(
    (invoice) => invoice.status === "paid"
  ).length;

  // Find unpaid invoices
  const unpaidInvoices = invoiceList.filter(
    (invoice) => invoice.status !== "paid"
  );

  // Calculate invoices due in seven days
  const dueInSevenDays = unpaidInvoices.filter(
    (invoice) =>
      invoice.due_date !== null &&
      invoice.due_date >= today &&
      invoice.due_date <= endDate
  );

  const dueTotal = dueInSevenDays.reduce(
    (total, invoice) =>
      total + Number(invoice.amount),
    0
  );

  // Five earliest-due unpaid invoices
  const dueSoon = unpaidInvoices
    .filter((invoice) => invoice.due_date !== null)
    .sort((a, b) =>
      (a.due_date ?? "").localeCompare(b.due_date ?? "")
    )
    .slice(0, 5);

  // Pass database values to the CoreUI dashboard
  return (
    <Dashboard
      firstName={firstName}
      greeting={getGreeting(now)}
      stats={{
        needsReview,
        dueInSevenDays: dueInSevenDays.length,
        dueTotal,
        awaitingApproval,
        paid,
      }}
      dueSoon={dueSoon}
    />
  );
}
