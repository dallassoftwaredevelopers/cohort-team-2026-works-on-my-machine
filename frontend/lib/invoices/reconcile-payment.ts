import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePaymentResult, paymentDecision, type PaymentAttempt } from "./payment";

export async function reconcilePaymentAttempt(
  supabase: SupabaseClient, attempt: PaymentAttempt,
  readRun: (runId: string) => Promise<{ status: string; output?: unknown }>, background = false,
) {
  if (attempt.status === "succeeded" || attempt.status === "failed") return { attempt, changed: false };
  if (!attempt.run_id && Date.now() - Date.parse(attempt.created_at) < 90_000) return { attempt, changed: false };
  let status: "succeeded" | "failed" | "uncertain" = "uncertain";
  let result = null;
  let message = "No task ID was saved. Check Browser Use and the vendor's payment history before resolving this attempt.";
  if (attempt.run_id) {
    const run = await readRun(attempt.run_id);
    if (["queued", "dispatching", "running"].includes(run.status)) return { attempt, changed: false };
    if (run.status === "completed") {
      result = parsePaymentResult(run.output);
      ({ status, message } = paymentDecision(attempt.expected, result));
    } else {
      message = `Browser Use task ${run.status}. Submission may have occurred; check payment history before resolving this attempt.`;
    }
  }
  if (attempt.status === status && attempt.message === message) return { attempt, changed: false };
  const saved = await supabase.rpc(background ? "finish_invoice_payment_in_background" : "finish_invoice_payment", {
    p_attempt_id: attempt.id, p_status: status, p_result: result, p_message: message,
  });
  if (saved.error) throw new Error(`Could not record payment outcome: ${saved.error.message}`);
  return { attempt: { ...attempt, status, message }, changed: true };
}
