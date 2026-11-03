import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import RulesForm from "./RulesForm.client";

export default function RulesPage() {
  return (
    <>
      <header className="mb-4">
        <h1 className="h3 mb-1">Approval rules</h1>
        <p className="text-body-secondary mb-0">Set the thresholds used to approve new invoices automatically.</p>
      </header>
      <Suspense fallback={<p className="text-body-secondary">Loading rules…</p>}>
        <RuleSettings />
      </Suspense>
    </>
  );
}

async function RuleSettings() {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) redirect("/login?next=/rules");

  const settingsResult = await supabase.from("approval_rule_settings")
      .select("max_auto_approval_amount, max_above_average_percent, min_comparable_bills")
      .eq("id", 1)
      .single();
  if (settingsResult.error) throw settingsResult.error;
  return <RulesForm settings={settingsResult.data} />;
}
