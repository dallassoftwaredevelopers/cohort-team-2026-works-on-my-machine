"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { BrowserUseError, browserUseConfigured, readBrowserPayment, startBrowserPayment } from "@/lib/invoices/browser-use";
import type { PaymentAttempt } from "@/lib/invoices/payment";
import { reconcilePaymentAttempt } from "@/lib/invoices/reconcile-payment";
import { paymentWorkerConfigured } from "@/lib/invoices/payment-worker-client";
import { start } from "workflow/api";
import { completeInvoicePayment } from "@/workflows/invoice-payment";

export type PaymentView = Pick<PaymentAttempt, "id" | "run_id" | "status" | "message" | "created_at">;
export type PaymentState = { attempt?: PaymentView; error?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function view(attempt: PaymentAttempt): PaymentView {
  return { id: attempt.id, run_id: attempt.run_id, status: attempt.status, message: attempt.message, created_at: attempt.created_at };
}

function invalidate(invoiceId: string) {
  revalidatePath(`/invoices/${invoiceId}/edit`);
  revalidatePath("/invoices");
  revalidatePath("/");
  revalidatePath("/events");
  refresh();
}

async function context(invoiceId: string) {
  if (!uuid.test(invoiceId)) throw new Error("Invalid invoice.");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Sign in to use demo payments.");
  return supabase;
}

async function latest(supabase: Awaited<ReturnType<typeof createClient>>, invoiceId: string) {
  const { data, error } = await supabase.from("invoice_payment_attempts").select("*")
    .eq("invoice_id", invoiceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PaymentAttempt | null;
}

export async function startDemoPayment(invoiceId: string): Promise<PaymentState> {
  try {
    const supabase = await context(invoiceId);
    if (!browserUseConfigured()) return { error: "Demo payments are not configured. Set BROWSER_USE_API_KEY on the server." };
    if (!paymentWorkerConfigured()) return { error: "Set SUPABASE_SECRET_KEY on the server to enable background payment completion." };
    const claim = await supabase.rpc("begin_invoice_payment", { p_invoice_id: invoiceId });
    if (claim.error) return { error: claim.error.message };
    const { claimed, attempt } = claim.data as { claimed: boolean; attempt: PaymentAttempt };
    if (!claimed) {
      // Starting a second watcher is safe: it never starts an external payment.
      // This also resumes checking an attempt created before background support.
      if (attempt.status === "starting" || attempt.status === "running") await start(completeInvoicePayment, [attempt.id]);
      return { attempt: view(attempt) };
    }

    try {
      // Queue the durable watcher BEFORE sending the external payment request.
      // If scheduling is unavailable, there is no external side effect to retry.
      await start(completeInvoicePayment, [attempt.id]);
    } catch {
      const message = "Could not schedule background payment checks. No payment task was submitted; try again.";
      const saved = await supabase.rpc("finish_invoice_payment", {
        p_attempt_id: attempt.id, p_status: "failed", p_result: null, p_message: message,
      });
      invalidate(invoiceId);
      if (saved.error) return { attempt: view(attempt), error: "Could not record the scheduling failure. Check the saved attempt before retrying." };
      return { attempt: view({ ...attempt, status: "failed", message }) };
    }

    let runId: string;
    try {
      runId = await startBrowserPayment(attempt.expected);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start demo payment. Check the Browser Use dashboard.";
      const status = error instanceof BrowserUseError && error.rejected ? "failed" : "uncertain";
      const saved = await supabase.rpc("finish_invoice_payment", {
        p_attempt_id: attempt.id, p_status: status, p_result: null, p_message: message,
      });
      invalidate(invoiceId);
      if (saved.error) return { attempt: view(attempt), error: "Could not save the task outcome. Check Browser Use before retrying." };
      return { attempt: view({ ...attempt, status, message }) };
    }
    const attached = await supabase.rpc("attach_invoice_payment_run", { p_attempt_id: attempt.id, p_run_id: runId });
    invalidate(invoiceId);
    if (attached.error) {
      return { attempt: view(attempt), error: `Browser Use task ${runId} started, but its ID could not be saved. Check that task before taking further action.` };
    }
    return { attempt: view({ ...attempt, status: "running", run_id: runId, message: "Demo payment in progress…" }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not start demo payment." };
  }
}

// POST Server Action: checking completion can also write the verified paid state.
// The browser supplies only the invoice ID, never an outcome or confirmation.
export async function checkDemoPayment(invoiceId: string): Promise<PaymentState> {
  try {
    const supabase = await context(invoiceId);
    const attempt = await latest(supabase, invoiceId);
    if (!attempt) return {};
    const result = await reconcilePaymentAttempt(supabase, attempt, readBrowserPayment);
    if (result.changed || result.attempt.status === "succeeded") invalidate(invoiceId);
    return { attempt: view(result.attempt) };
  } catch (error) {
    // A failed status read does not change a running task into a retryable failure.
    return { error: error instanceof Error ? error.message : "Could not check demo payment. Try checking again." };
  }
}

export async function resolveDemoPayment(invoiceId: string, form: FormData): Promise<PaymentState> {
  try {
    const supabase = await context(invoiceId);
    const attempt = await latest(supabase, invoiceId);
    if (!attempt || attempt.status !== "uncertain") return { error: "Only an uncertain payment can be resolved." };
    if (form.get("reviewed") !== "on") return { error: "Confirm that the task has stopped and you checked payment history." };
    const confirmation = String(form.get("confirmation") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim();
    if (confirmation.length > 200 || !reason || reason.length > 500) return { error: "Enter a review note of up to 500 characters and a confirmation of up to 200 characters." };
    if (attempt.run_id) {
      const run = await readBrowserPayment(attempt.run_id);
      if (["queued", "dispatching", "running"].includes(run.status)) return { error: "The task is still running. Wait for it to stop before resolving the payment." };
    }
    const { error } = await supabase.rpc("resolve_invoice_payment", {
      p_attempt_id: attempt.id, p_confirmation: confirmation || null, p_reason: reason,
    });
    if (error) return { error: error.message };
    invalidate(invoiceId);
    return { attempt: view({ ...attempt, status: confirmation ? "succeeded" : "failed", message: `Reviewed: ${reason}` }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not resolve the payment." };
  }
}
