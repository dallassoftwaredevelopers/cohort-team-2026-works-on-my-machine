import { revalidatePath } from "next/cache";
import { createPaymentWorkerClient } from "@/lib/invoices/payment-worker-client";
import { reconcilePaymentAttempt } from "@/lib/invoices/reconcile-payment";
import type { PaymentAttempt } from "@/lib/invoices/payment";
import { RetryableError } from "workflow";
import { readBrowserPayment } from "@/lib/invoices/browser-use";

function invalidate(invoiceId: string) {
  revalidatePath(`/invoices/${invoiceId}/edit`);
  revalidatePath("/invoices");
  revalidatePath("/");
  revalidatePath("/events");
}

export async function checkPaymentStep(attemptId: string): Promise<boolean> {
  "use step";
  const supabase = createPaymentWorkerClient();
  const { data, error } = await supabase.from("invoice_payment_attempts").select("*").eq("id", attemptId).single();
  if (error) throw new Error("Could not read the saved payment attempt.");
  const attempt = data as PaymentAttempt;
  if (["succeeded", "failed", "uncertain"].includes(attempt.status)) return true;
  // Retries repeat only GETs and an idempotent, transactional settlement RPC.
  let result;
  try { result = await reconcilePaymentAttempt(supabase, attempt, readBrowserPayment, true); }
  catch { throw new RetryableError("Payment status is temporarily unavailable.", { retryAfter: "30s" }); }
  if (result.changed) invalidate(attempt.invoice_id);
  return ["succeeded", "failed", "uncertain"].includes(result.attempt.status);
}
checkPaymentStep.maxRetries = 20;

export async function expirePaymentStep(attemptId: string, message: string) {
  "use step";
  const supabase = createPaymentWorkerClient();
  const { data, error } = await supabase.from("invoice_payment_attempts").select("invoice_id, status").eq("id", attemptId).single();
  if (error) throw new Error("Could not read the saved payment attempt.");
  if (data.status !== "starting" && data.status !== "running") return;
  const saved = await supabase.rpc("finish_invoice_payment_in_background", {
    p_attempt_id: attemptId, p_status: "uncertain", p_result: null,
    p_message: message,
  });
  if (saved.error) throw new Error("Could not record the payment timeout.");
  invalidate(data.invoice_id);
}
