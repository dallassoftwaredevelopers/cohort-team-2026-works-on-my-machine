import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PlaywrightExecutor } from "./executor";
import { preparePayment } from "./orchestrator";
import type { AgentMessage, Observation, Planner } from "./types";
import { testInvoice } from "./__fixtures__/invoice";

function fixture(layout: number) {
  const fields = ['<label>Account holder name<input name="bankName"></label>', '<label>Routing number<input name="routingNumber"></label>', '<label>Account number<input name="accountNumber"></label>', '<label>Confirm account number<input name="confirmAccountNumber"></label>'];
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><header>Alder Creek Landscaping · No money moves</header><label>Property / service account<select><option value="legacy">Industrial Commons · 2000456700</option></select></label>
  <${layout === 1 ? "main" : "section"}><h1>${layout === 2 ? "Online remittance" : "Make a payment"}</h1><form>
  <label>Payment method<select name="method"><option value="bank">Bank account (one-time ACH)</option></select></label>
  ${(layout === 2 ? fields.reverse() : fields).join("")}
  <label>Account type<select name="accountType"><option value="checking">Checking</option></select></label>
  <label>Simulated result<select name="scenario"><option value="success">Successful payment</option></select></label>
  <label><input type="checkbox" name="authorized">I authorize this simulated one-time ACH payment</label>
  <button type="submit">${layout === 1 ? "Review payment" : "Pay $186.42"}</button></form>
  <button type="button" onclick="fetch('/api/payments',{method:'POST',body:'{}'}).catch(()=>{})">Continue</button>
  <aside><dl><dt>Bill number</dt><dd>BILL-1001</dd><dt>Payment fee</dt><dd>$0.00</dd></dl>Total payment $186.42</aside></${layout === 1 ? "main" : "section"}>
  <script>
  const form=document.querySelector('form');
  async function pay(){const f=Object.fromEntries(new FormData(form));const r=await fetch('/api/payments',{method:'POST',body:JSON.stringify({billId:'BILL-1001',serviceAccountId:'legacy',requestId:'portal-generated',method:f.method,scenario:f.scenario,details:{name:f.bankName,routingNumber:f.routingNumber,accountNumber:f.accountNumber,confirmAccountNumber:f.confirmAccountNumber,accountType:f.accountType,authorized:f.authorized==='on'}})}); const {payment}=await r.json(); location.hash='receipt/'+payment.id;document.body.innerHTML='<h1>Payment complete.</h1><dl><dt>Confirmation number</dt><dd>'+payment.id+'</dd><dt>Bill number</dt><dd>BILL-1001</dd><dt>Amount</dt><dd>$186.42</dd><dt>Status</dt><dd>Completed</dd></dl>';}
  form.onsubmit=e=>{e.preventDefault();${layout === 1 ? "form.hidden=true; const b=document.createElement('button');b.textContent='Submit payment';b.onclick=pay;document.body.append(b);" : "pay();"}};
  </script></body></html>`;
}
const fixturePlanner: Planner = { async next(messages) {
  const observation = JSON.parse(messages[messages.length - 1].content!) as Observation;
  const control = observation.controls.find(c => c.label === "Account holder name");
  // Scripted responses emulate the model; the real executor and its network gate are exercised.
  const prior = messages.filter(m => m.role === "assistant").length;
  const names = ["Account holder name", "Routing number", "Account number", "Confirm account number"];
  const fields = ["holder", "routing", "fundingAccount", "confirmFundingAccount"] as const;
  const chosen = observation.controls.find(c => c.label === names[prior]);
  assert.ok(control);
  const action = chosen ? { type: "fill_field" as const, controlId: chosen.id, field: fields[prior] } : { type: "finish" as const };
  return { id: `tool-${prior}`, action, message: { role: "assistant", content: null } as AgentMessage };
} };

for (const layout of [0, 1, 2]) test(`real Chromium executor completes offline mock layout ${layout}, blocks premature and duplicate submissions`, { timeout: 30000 }, async () => {
  let payments = 0; let requestId = ""; let paid = false;
  const executor = await PlaywrightExecutor.create(testInvoice, async context => {
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/account") return route.fulfill({ json: { serviceAccounts: [{ id: "legacy", number: "2000456700", name: "Alder Creek Workshop", propertyName: "Industrial Commons" }], bills: [{ id: "BILL-1001", serviceAccountId: "legacy", amountCents: 18642, status: paid ? "paid" : "unpaid" }], payments: paid ? [{ id: "PAY-TEST", billId: "BILL-1001", serviceAccountId: "legacy", amountCents: 18642, status: "succeeded" }] : [] } });
      if (url.pathname === "/api/payments") { payments++; requestId = route.request().postDataJSON().requestId; paid = true; return route.fulfill({ json: { payment: { id: "PAY-TEST", status: "succeeded" } } }); }
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: fixture(layout) });
      return route.abort();
    });
  });
  try {
    const observation = await executor.observe();
    const pay = observation.controls.find(c => /Pay \$|Review payment/.test(c.label))!;
    await assert.rejects(executor.execute({ type: "click_element", controlId: pay.id }), /not permitted/);
    await assert.rejects(executor.execute({ type: "navigate", url: "http://127.0.0.1" }), /rejected/);
    const safeLooking = (await executor.observe()).controls.find(c => c.label === "Continue")!;
    await executor.execute({ type: "click_element", controlId: safeLooking.id });
    // A harmless-looking control cannot bypass the network submission gate.
    assert.equal(payments, 0);
    await assert.rejects(executor.execute({ type: "click_element", controlId: safeLooking.id }), /Stale/);
    await preparePayment(testInvoice, executor, fixturePlanner, async () => {});
    assert.equal(payments, 0);
    const id = randomUUID();
    const receipt = await executor.submit(id);
    assert.equal(receipt.confirmation, "PAY-TEST"); assert.equal(payments, 1); assert.equal(requestId, id);
    await assert.rejects(executor.submit(id), /Duplicate/); assert.equal(payments, 1);
  } finally { await executor.close(); }
});


for (const mismatch of ["account", "amount", "vendor", "fee"] as const) test(`independent verifier rejects ${mismatch} mismatch before submission`, { timeout: 15000 }, async () => {
  let paymentRequests = 0;
  const executor = await PlaywrightExecutor.create(testInvoice, async context => {
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/account") return route.fulfill({ json: {
        serviceAccounts: [{ id: "legacy", number: "2000456700", name: "Alder Creek Workshop", propertyName: "Industrial Commons" }],
        bills: [{ id: "BILL-1001", serviceAccountId: "legacy", amountCents: mismatch === "amount" ? 18643 : 18642, status: "unpaid" }], payments: [],
      } });
      if (url.pathname === "/api/payments") { paymentRequests++; return route.abort(); }
      let html = fixture(0);
      if (mismatch === "account") html = html.replace('value="legacy">Industrial Commons', 'value="other">Industrial Commons');
      if (mismatch === "vendor") html = html.replace("Alder Creek Landscaping", "Unknown Vendor");
      if (mismatch === "fee") html = html.replace("$0.00", "$1.00");
      return route.fulfill({ contentType: "text/html", body: html });
    });
  });
  try {
    for (const [label, field] of [["Account holder name", "holder"], ["Routing number", "routing"], ["Account number", "fundingAccount"], ["Confirm account number", "confirmFundingAccount"]] as const) {
      const observation = await executor.observe();
      await executor.execute({ type: "fill_field", controlId: observation.controls.find(c => c.label === label)!.id, field });
    }
    await assert.rejects(executor.ready(), /mismatch|Wrong customer account/i);
    assert.equal(paymentRequests, 0);
  } finally { await executor.close(); }
});
