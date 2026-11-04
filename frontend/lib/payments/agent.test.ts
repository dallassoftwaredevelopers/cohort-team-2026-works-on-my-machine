import assert from "node:assert/strict";
import test from "node:test";
import { actionSchema, type AgentMessage, type BrowserExecutor, type Observation, type Planner } from "./types";
import { cents, navigationAllowed, portalFor } from "./policy";
import { preparePayment } from "./orchestrator";

import { testInvoice } from "./__fixtures__/invoice";
test("exact mock vendor mapping and decimal money", () => {
  assert.equal(cents("186.42"), 18642);
  assert.equal(cents("0.01"), 1);
  for (const amount of ["-1", "0", "1e3", "1.234", "NaN", "Infinity"]) assert.throws(() => cents(amount));
  assert.equal(portalFor(testInvoice).name, testInvoice.vendorName);
  for (const paymentUrl of ["https://example.com", "http://127.0.0.1", "https://alder-creek-utility-demo.vercel.app.evil.com", "https://user@alder-creek-utility-demo.vercel.app", "https://alder-creek-utility-demo.vercel.app/api/reset"]) assert.throws(() => portalFor({ ...testInvoice, paymentUrl }));
});
test("navigation cannot reach mutation controls, arbitrary hosts, or internal networks", () => {
  const origin = portalFor(testInvoice).origin;
  for (const path of ["/#account", "/#pay/BILL-1001", "/#statement/BILL-1001"]) assert.ok(navigationAllowed(origin + path, origin));
  for (const url of [origin + "/#controls", origin + "/api/reset", origin + "/?redirect=https://evil.com", "javascript:alert(1)", "http://localhost", "http://169.254.169.254"]) assert.equal(navigationAllowed(url, origin), false);
});
test("arbitrary JS, selectors, raw values, submit tools, and extra arguments are rejected", () => {
  for (const action of [{ type: "evaluate", code: "alert(1)" }, { type: "submit" }, { type: "click_element", selector: "button" }, { type: "fill_field", controlId: "1:1", field: "amount", value: "999" }, { type: "finish", confirmation: "fake" }]) assert.equal(actionSchema.safeParse(action).success, false);
});
class FakeBrowser implements BrowserExecutor {
  executions = 0; readyChecks = 0; closed = false;
  async observe(): Promise<Observation> { return { url: testInvoice.paymentUrl, text: "mock", controls: [] }; }
  async execute() { this.executions++; }
  async ready() { this.readyChecks++; }
  async submit(): Promise<never> { throw new Error("Preparation must never submit"); }
  async close() { this.closed = true; }
}
function planner(actions: unknown[]): Planner {
  return { async next() { const action = actionSchema.parse(actions.shift()); return { id: "tool-1", action, message: { role: "assistant", content: null } }; } };
}
test("successful orchestration returns ready without submitting", async () => {
  const browser = new FakeBrowser(); const events: unknown[] = [];
  await preparePayment(testInvoice, browser, planner([{ type: "inspect_page" }, { type: "finish" }]), async event => { events.push(event); });
  assert.equal(browser.executions, 1); assert.equal(browser.readyChecks, 1); assert.equal(events.length, 3);
});
test("invalid model action cannot reach browser", async () => {
  const browser = new FakeBrowser();
  await assert.rejects(preparePayment(testInvoice, browser, planner([{ type: "evaluate" }]), async () => {}));
  assert.equal(browser.executions, 0);
});
test("timeouts abort outstanding work and close browser", async () => {
  const browser = new FakeBrowser();
  const waiting: Planner = { next: async (_messages: AgentMessage[], signal: AbortSignal) => new Promise((_resolve, reject) => {
    const keepAlive = setTimeout(() => reject(new Error("Unexpected planner stall")), 1000);
    signal.addEventListener("abort", () => { clearTimeout(keepAlive); reject(signal.reason); }, { once: true });
  }) };
  await assert.rejects(preparePayment(testInvoice, browser, waiting, async () => {}, { maxSteps: 2, timeoutMs: 25 }));
  assert.ok(browser.closed); assert.equal(browser.executions, 0);
});
test("step budget stops loops", async () => {
  await assert.rejects(preparePayment(testInvoice, new FakeBrowser(), planner([{ type: "inspect_page" }, { type: "inspect_page" }]), async () => {}, { maxSteps: 2, timeoutMs: 5000 }), /step limit/);
});

import { mockPaymentEnabled } from "./config";
test("mock agent defaults off and cannot be enabled in Vercel production", () => {
  assert.equal(mockPaymentEnabled({}), false);
  assert.equal(mockPaymentEnabled({ MOCK_PAYMENT_AGENT_ENABLED: "true", VERCEL_ENV: "preview" }), true);
  assert.equal(mockPaymentEnabled({ MOCK_PAYMENT_AGENT_ENABLED: "true", VERCEL_ENV: "production" }), false);
});
