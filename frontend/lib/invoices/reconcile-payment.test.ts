import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcilePaymentAttempt } from "./reconcile-payment";
import type { PaymentAttempt, PaymentResult } from "./payment";

const attempt: PaymentAttempt = {
  id: "attempt", invoice_id: "invoice", run_id: "run", status: "running", message: "In progress",
  created_at: "2026-01-01T00:00:00Z",
  expected: { payment_url: "https://alder-creek-utility-demo.vercel.app", account_number: "123", invoice_number: "BILL-1001", amount: "287.61", currency: "USD" },
};
const receipt: PaymentResult = {
  outcome: "succeeded", confirmation_number: "PAY-123", account_number: "123", invoice_number: "BILL-1001",
  amount: "287.61", currency: "USD", message: "Receipt verified.",
};
function database(error = false) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client = { async rpc(name: string, args: Record<string, unknown>) {
    calls.push({ name, args });
    return { error: error ? { message: "Database unavailable" } : null };
  } } as unknown as SupabaseClient;
  return { client, calls };
}

test("background completion validates the receipt and calls only the worker settlement RPC", async () => {
  const db = database();
  const result = await reconcilePaymentAttempt(db.client, attempt, async (id) => {
    assert.equal(id, "run"); return { status: "completed", output: receipt };
  }, true);
  assert.equal(result.attempt.status, "succeeded");
  assert.equal(result.changed, true);
  assert.deepEqual(db.calls, [{ name: "finish_invoice_payment_in_background", args: {
    p_attempt_id: "attempt", p_status: "succeeded", p_result: receipt, p_message: receipt.message,
  } }]);
});

test("interactive checks use the same validation with the authenticated settlement RPC", async () => {
  const db = database();
  await reconcilePaymentAttempt(db.client, attempt, async () => ({ status: "completed", output: receipt }));
  assert.equal(db.calls[0].name, "finish_invoice_payment");
});

test("queued/running tasks are left alone; settled attempts do not call the provider again", async () => {
  const db = database();
  for (const status of ["queued", "dispatching", "running"]) {
    assert.equal((await reconcilePaymentAttempt(db.client, attempt, async () => ({ status }))).changed, false);
  }
  for (const status of ["succeeded", "failed"] as const) {
    await reconcilePaymentAttempt(db.client, { ...attempt, status }, async () => { assert.fail("Already settled"); });
  }
  assert.equal(db.calls.length, 0);
});

test("mismatched/malformed receipts and provider failure/cancellation stay uncertain", async () => {
  for (const run of [
    { status: "completed", output: { ...receipt, amount: "287.62" } },
    { status: "completed", output: "not JSON" }, { status: "failed" }, { status: "cancelled" },
  ]) {
    const db = database();
    const result = await reconcilePaymentAttempt(db.client, attempt, async () => run, true);
    assert.equal(result.attempt.status, "uncertain");
    assert.equal(db.calls[0].args.p_status, "uncertain");
  }
});

test("a verified no-submission failure is retryable", async () => {
  const db = database();
  const result = await reconcilePaymentAttempt(db.client, attempt, async () => ({
    status: "completed", output: { ...receipt, outcome: "failed", confirmation_number: null },
  }), true);
  assert.equal(result.attempt.status, "failed");
});

test("read outages do not release reservations, and failed settlement is propagated for retry", async () => {
  const db = database();
  await assert.rejects(reconcilePaymentAttempt(db.client, attempt, async () => { throw new Error("Network outage"); }, true), /Network outage/);
  assert.equal(db.calls.length, 0);
  const failed = database(true);
  await assert.rejects(reconcilePaymentAttempt(failed.client, attempt, async () => ({ status: "completed", output: receipt }), true), /Database unavailable/);
  assert.equal(attempt.status, "running");
});

test("missing task IDs wait for start to finish, then become uncertain without creating another task", async () => {
  const db = database();
  const neverRead = async () => { assert.fail("There is no task ID to read"); };
  const young = { ...attempt, run_id: null, status: "starting" as const, created_at: new Date().toISOString() };
  assert.equal((await reconcilePaymentAttempt(db.client, young, neverRead, true)).changed, false);
  assert.equal(db.calls.length, 0);
  const stale = await reconcilePaymentAttempt(db.client, { ...young, created_at: attempt.created_at }, neverRead, true);
  assert.equal(stale.attempt.status, "uncertain");
  assert.equal(db.calls.length, 1);
});
