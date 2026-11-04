import { createClient } from "@supabase/supabase-js";
import { setTimeout as delay } from "node:timers/promises";
import { invoiceSchema } from "../lib/payments/types";
import { OpenRouterPlanner } from "../lib/payments/openrouter";
import { PlaywrightExecutor } from "../lib/payments/executor";
import { preparePayment } from "../lib/payments/orchestrator";

if (process.env.VERCEL_ENV === "production") throw new Error("Mock payment worker is disabled in Vercel production");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error("Worker requires Supabase URL and server-only service-role key");
const db = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) },
});
const planner = new OpenRouterPlanner(process.env.OPENROUTER_API_KEY || "", process.env.OPENROUTER_MODEL || "");

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
async function run(job: { id: string; lease_token: string; snapshot: unknown }) {
  const invoice = invoiceSchema.parse(job.snapshot);
  const advance = (state: string, event: Record<string, unknown> = {}) => rpc("advance_mock_payment_agent", { p_job_id: job.id, p_token: job.lease_token, p_state: state, p_event: event });
  let browser: PlaywrightExecutor | undefined;
  let submitting = false;
  let leaseLost = false;
  let heartbeatBusy = false;
  const heartbeat = setInterval(() => {
    if (heartbeatBusy) return;
    heartbeatBusy = true;
    void advance("heartbeat").catch(() => { leaseLost = true; void browser?.close(); }).finally(() => { heartbeatBusy = false; });
  }, 15000);
  const deadline = setTimeout(() => { leaseLost = true; void browser?.close(); }, 15 * 60000);
  async function state() {
    const { data, error } = await db.from("payment_agent_jobs").select("state,authorization_expires_at").eq("id", job.id).single();
    if (error) throw new Error(error.message);
    if (leaseLost) throw new Error("Worker deadline or lease lost");
    return data;
  }
  try {
    browser = await PlaywrightExecutor.create(invoice);
    await preparePayment(invoice, browser, planner, async event => {
      const current = await state();
      if (current.state !== "preparing") throw new Error("Preparation cancelled");
      await advance("heartbeat", event);
    });
    await advance("awaiting_authorization");
    while (true) {
      const current = await state();
      if (current.state === "authorized") break;
      if (current.state !== "awaiting_authorization") throw new Error("Payment cancelled");
      if (Date.parse(current.authorization_expires_at) <= Date.now()) {
        await advance("expired", { error: "Authorization window expired" }); return;
      }
      await delay(1000);
    }
    // Validate again before consuming authorization, then never retry submission.
    await browser.ready();
    await advance("submitting");
    submitting = true;
    const receipt = await browser.submit(job.id);
    await rpc("finalize_mock_payment_agent", { p_job_id: job.id, p_token: job.lease_token, p_receipt: receipt });
    console.log(`Mock payment ${job.id} confirmed: ${receipt.confirmation}`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Worker failed";
    console.error(`Mock payment ${job.id}: ${message}`);
    try { await advance(submitting ? "needs_review" : "failed", { error: message }); }
    catch { /* A cancelled job or lost lease remains authoritative; the sweeper handles expired leases. */ }
  } finally {
    clearInterval(heartbeat); clearTimeout(deadline); await browser?.close();
  }
}

async function main() {
 await planner.checkModel();
 console.log("Mock payment worker ready (fictional ACH only)");
 while (true) {
  try {
    const jobs = await rpc("claim_mock_payment_agent");
    if (jobs?.[0]) await run(jobs[0]); else await delay(2000);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Worker error"); await delay(5000);
  }
 }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Worker startup failed"); process.exitCode = 1; });
