import assert from "node:assert/strict";
import test from "node:test";
import { cents, isDemoPaymentUrl, parsePaymentResult, paymentDecision, paymentPrompt, type PaymentResult, type PaymentSnapshot } from "./payment";

const expected: PaymentSnapshot = {
  payment_url: "https://alder-creek-utility-demo.vercel.app",
  account_number: "2000456709", invoice_number: "BILL-1001", amount: "287.61", currency: "USD",
};
const receipt: PaymentResult = {
  outcome: "succeeded", confirmation_number: "PAY-AE9AE6F0", account_number: "2000456709",
  invoice_number: "BILL-1001", amount: "287.61", currency: "USD", message: "Receipt and history show completed payment.",
};

test("matching structured receipt succeeds, including JSON string fallback", () => {
  assert.deepEqual(parsePaymentResult(JSON.stringify(receipt)), receipt);
  assert.equal(paymentDecision(expected, parsePaymentResult(receipt)).status, "succeeded");
});

test("every payment identity field must match, and confirmation is required", () => {
  for (const [field, value] of Object.entries({
    account_number: "other", invoice_number: "BILL-1002", amount: "287.62", currency: "EUR", confirmation_number: " ",
  })) {
    assert.equal(paymentDecision(expected, { ...receipt, [field]: value }).status, "uncertain", field);
  }
  for (const field of ["account_number", "invoice_number", "amount", "currency", "confirmation_number"] as const) {
    assert.equal(paymentDecision(expected, { ...receipt, [field]: null }).status, "uncertain", field);
  }
});

test("amount comparison uses exact decimal cents", () => {
  assert.equal(cents("0.10"), BigInt(10));
  assert.equal(cents("9999999999.99"), BigInt("999999999999"));
  assert.equal(paymentDecision({ ...expected, amount: "287.60" }, { ...receipt, amount: "287.6" }).status, "succeeded");
  for (const value of ["287.610", "2e2", "$287.61", "287,61", "-1", "NaN", 287.61, null]) assert.equal(cents(value), null);
});

test("review messages identify the mismatched field and the expected/returned values", () => {
  const mismatch = paymentDecision(expected, { ...receipt, account_number: "different", amount: "186.42", invoice_number: null });
  assert.equal(mismatch.status, "uncertain");
  assert.match(mismatch.message, /account number: expected "2000456709", returned "different"/);
  assert.match(mismatch.message, /invoice number: expected "BILL-1001", returned missing/);
  assert.match(mismatch.message, /amount: expected "287.61", returned "186.42"/);
  assert.doesNotMatch(mismatch.message, /currency:/);
  assert.match(paymentDecision(expected, { ...receipt, confirmation_number: null }).message, /confirmation number is missing/);
  assert.match(paymentDecision(expected, { ...receipt, currency: "EUR" }).message, /currency: expected "USD", returned "EUR"/);
});

test("a completed payment without a verified account is held for review with a specific explanation", () => {
  const result = paymentDecision(expected, { ...receipt, account_number: null });
  assert.equal(result.status, "uncertain");
  assert.match(result.message, /account number: expected "2000456709", returned missing/);
  assert.doesNotMatch(result.message, /amount:|invoice number:|currency:/);
});

test("malformed and incomplete agent responses cannot mark an invoice paid", () => {
  for (const value of [null, [], {}, "not JSON", "```json\n{}\n```", { ...receipt, outcome: "done" },
    { ...receipt, extra: true }, { ...receipt, message: null }, { ...receipt, confirmation_number: 123 },
    { ...receipt, confirmation_number: "x".repeat(201) }, { ...receipt, message: "x".repeat(1001) }]) {
    assert.equal(parsePaymentResult(value), null);
    assert.equal(paymentDecision(expected, parsePaymentResult(value)).status, "uncertain");
  }
});

test("only explicit no-submission failure is retryable", () => {
  assert.equal(paymentDecision(expected, { ...receipt, outcome: "failed", confirmation_number: null }).status, "failed");
  assert.equal(paymentDecision(expected, { ...receipt, outcome: "failed" }).status, "uncertain");
  assert.equal(paymentDecision(expected, { ...receipt, outcome: "uncertain", confirmation_number: null }).status, "uncertain");
});

test("only exact HTTPS cohort demo hosts can start a payment", () => {
  assert.ok(isDemoPaymentUrl(expected.payment_url));
  assert.ok(isDemoPaymentUrl("https://sunmeadow-utility-demo.vercel.app/pay?invoice=BILL-1001"));
  for (const value of ["http://alder-creek-utility-demo.vercel.app", "https://example.com", "https://localhost",
    "https://alder-creek-utility-demo.vercel.app.evil.test", "https://evil.alder-creek-utility-demo.vercel.app",
    "https://name:pass@alder-creek-utility-demo.vercel.app", "https://alder-creek-utility-demo.vercel.app:8443", "invalid"]) {
    assert.equal(isDemoPaymentUrl(value), false, value);
    assert.throws(() => paymentPrompt({ ...expected, payment_url: value }));
  }
});

test("prompt carries the invoice data and instructs a single submission and history verification", () => {
  const prompt = paymentPrompt(expected);
  assert.ok(prompt.includes(JSON.stringify(expected)));
  assert.match(prompt, /Submit at most once/);
  assert.match(prompt, /existing receipt instead of paying again/);
  assert.match(prompt, /Never use expected values copied as evidence/);
  assert.match(prompt, /Receipts may omit these identifiers/);
  assert.match(prompt, /do not discard a number you already verified earlier on the site/);
});
