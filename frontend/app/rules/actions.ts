"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type RuleValues = {
  max_auto_approval_amount: string;
  max_above_average_percent: string;
  min_comparable_bills: string;
};
export type RuleFormState = { error?: string; success?: boolean; values: RuleValues } | undefined;

export async function saveRules(_previous: RuleFormState, formData: FormData): Promise<RuleFormState> {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!data?.claims) throw new Error("Unauthorized");

  const values: RuleValues = {
    max_auto_approval_amount: String(formData.get("max_auto_approval_amount") ?? "").trim(),
    max_above_average_percent: String(formData.get("max_above_average_percent") ?? "").trim(),
    min_comparable_bills: String(formData.get("min_comparable_bills") ?? "").trim(),
  };

  const decimal = /^\d+(?:\.\d{1,2})?$/;
  const amount = Number(values.max_auto_approval_amount);
  const percent = Number(values.max_above_average_percent);
  const count = Number(values.min_comparable_bills);
  if (!decimal.test(values.max_auto_approval_amount) || amount <= 0 || amount > 9999999999.99) {
    return { error: "Enter an amount limit greater than zero, with up to two decimal places.", values };
  }
  if (!decimal.test(values.max_above_average_percent) || percent > 99999.99) {
    return { error: "Enter a percentage of zero or more, with up to two decimal places.", values };
  }
  if (!/^[1-9]\d*$/.test(values.min_comparable_bills) || count > 2147483647) {
    return { error: "Enter at least one comparable bill.", values };
  }

  const { error } = await supabase.from("approval_rule_settings")
    .update({
      max_auto_approval_amount: amount,
      max_above_average_percent: percent,
      min_comparable_bills: count,
    })
    .eq("id", 1)
    .select("id")
    .single();
  if (error) return { error: `Could not save approval rules: ${error.message}`, values };

  revalidatePath("/rules");
  refresh();
  return { success: true, values };
}
