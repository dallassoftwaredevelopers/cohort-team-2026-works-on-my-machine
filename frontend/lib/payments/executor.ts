import { chromium, type Browser, type BrowserContext, type Page, type Locator } from "playwright";
import { z } from "zod";
import { cents, demoValues, navigationAllowed, portalFor } from "./policy";
import { actionSchema, type AgentAction, type BrowserExecutor, type Observation, type PaymentInvoice, type VerifiedPayment } from "./types";

const accountSchema = z.object({
  serviceAccounts: z.array(z.object({ id: z.string(), number: z.string(), name: z.string(), propertyName: z.string().optional() })),
  bills: z.array(z.object({ id: z.string(), serviceAccountId: z.string(), amountCents: z.number().int(), status: z.string() })),
  payments: z.array(z.object({ id: z.string(), billId: z.string(), serviceAccountId: z.string(), amountCents: z.number().int(), status: z.string() })),
});
type Control = Observation["controls"][number] & { locator: Locator; fingerprint: string };
const controlSelector = "input:not([type=hidden]),select,button,a[href],textarea";
const labels = {
  email: /email/i, password: /password/i, holder: /account holder|name on|bank name/i,
  routing: /routing/i, fundingAccount: /^account number$/i, confirmFundingAccount: /confirm account/i,
  invoiceReference: /bill|invoice|reference/i, customerAccount: /customer.*account|service.*account/i, amount: /amount/i,
};

export class PlaywrightExecutor implements BrowserExecutor {
  private controls = new Map<string, Control>();
  private revision = 0;
  private armed = false;
  private sent = false;
  private intentId = "";
  private serviceAccountId = "";
  private paymentResponse: unknown;
  private origin: string;
  private constructor(private browser: Browser, private context: BrowserContext, private page: Page, private invoice: PaymentInvoice) {
    this.origin = portalFor(invoice).origin;
  }
  static async create(invoice: PaymentInvoice, configureContext?: (context: BrowserContext) => Promise<void>) {
    portalFor(invoice);
    const browser = await chromium.launch({ headless: process.env.PAYMENT_HEADLESS !== "false" });
    try {
      const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
      // Tests install an offline transport before the policy route; policy always runs first.
      await configureContext?.(context);
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      page.setDefaultNavigationTimeout(15000);
      const executor = new PlaywrightExecutor(browser, context, page, invoice);
      await context.routeWebSocket("**/*", socket => socket.close());
      await context.route("**/*", async route => {
        const request = route.request();
        try {
          const url = new URL(request.url());
          if (url.origin !== executor.origin || url.username || url.password || url.search) return await route.abort();
          if (request.isNavigationRequest() && (request.frame() !== page.mainFrame() || !navigationAllowed(request.url(), executor.origin))) return await route.abort();
          if (request.method() === "GET" && (url.pathname === "/" || url.pathname === "/api/account" || /^\/[\w./-]+\.(?:js|css|svg|png|ico|woff2?)$/.test(url.pathname))) return await route.fallback();
          if (request.method() === "POST" && url.pathname === "/api/login") {
            const body = request.postDataJSON();
            if (body.email === demoValues.email && body.password === demoValues.password && Object.keys(body).every(k => ["email", "password"].includes(k))) return await route.fallback();
          }
          if (request.method() === "POST" && url.pathname === "/api/payments" && executor.armed && !executor.sent) {
            const payload = executor.validatedPayload(request.postDataJSON());
            executor.sent = true;
            return await route.fallback({ postData: JSON.stringify({ ...payload, requestId: executor.intentId }) });
          }
          await route.abort();
        } catch { await route.abort(); }
      });
      page.on("popup", popup => { void popup.close(); });
      page.on("download", download => { void download.cancel(); });
      page.on("dialog", dialog => { void dialog.dismiss(); });
      page.on("response", response => {
        if (response.url() === executor.origin + "/api/payments" && response.request().method() === "POST") {
          void response.json().then(data => { executor.paymentResponse = data; }).catch(() => {});
        }
      });
      await page.goto(invoice.paymentUrl, { waitUntil: "networkidle" });
      return executor;
    } catch (error) { await browser.close(); throw error; }
  }
  private validatedPayload(value: unknown) {
    const payload = z.object({ method: z.literal("bank"), scenario: z.literal("success"), billId: z.literal(this.invoice.reference), requestId: z.string(), serviceAccountId: z.literal(this.serviceAccountId), details: z.object({ name: z.literal(demoValues.holder), accountType: z.literal("checking"), routingNumber: z.literal(demoValues.routing), accountNumber: z.literal(demoValues.fundingAccount), confirmAccountNumber: z.literal(demoValues.confirmFundingAccount), authorized: z.literal(true) }).strict() }).strict();
    return payload.parse(value);
  }
  async observe(): Promise<Observation> {
    this.controls.clear();
    this.revision++;
    if (!navigationAllowed(this.page.url(), this.origin)) throw new Error("Page left allowed navigation scope");
    const text = (await this.page.locator("body").innerText()).slice(0, 16000);
    const elements = this.page.locator(controlSelector);
    for (let i = 0; i < Math.min(await elements.count(), 150); i++) {
      const locator = elements.nth(i);
      if (!await locator.isVisible() || !await locator.isEnabled()) continue;
      const metadata = await locator.evaluate(el => {
        const element = el as HTMLInputElement;
        const label = element.getAttribute("aria-label") || (element.labels && Array.from(element.labels).map(l => l.childNodes[0]?.textContent || "").join(" ")) || element.textContent || element.getAttribute("placeholder") || element.name || "";
        const options = el instanceof HTMLSelectElement ? Array.from(el.options).map(o => ({ value: o.value, label: o.text })) : undefined;
        return { label: label.trim().slice(0, 200), kind: el.tagName.toLowerCase() + ":" + (element.type || ""), options, fingerprint: [el.tagName, element.type, element.name, el.getAttribute("href"), label].join("|") };
      });
      const id = `${this.revision}:${i}`;
      this.controls.set(id, { id, locator, ...metadata });
    }
    return { url: this.page.url(), text, controls: [...this.controls.values()].map(({ id, label, kind, options }) => ({ id, label, kind, options })) };
  }
  async execute(input: AgentAction) {
    const action = actionSchema.parse(input);
    if (action.type === "inspect_page") return;
    if (action.type === "navigate") {
      const url = new URL(action.url, this.page.url()).href;
      if (!navigationAllowed(url, this.origin)) throw new Error("Navigation rejected");
      await this.page.goto(url, { waitUntil: "networkidle" }); this.controls.clear(); return;
    }
    if (!("controlId" in action)) throw new Error("Unsupported browser action");
    const control = this.controls.get(action.controlId);
    if (!control) throw new Error("Stale or unknown control ID");
    const fingerprint = await control.locator.evaluate(el => {
      const e = el as HTMLInputElement;
      const label = e.getAttribute("aria-label") || (e.labels && Array.from(e.labels).map(l => l.childNodes[0]?.textContent || "").join(" ")) || e.textContent || e.getAttribute("placeholder") || e.name || "";
      return [e.tagName, e.type, e.name, e.getAttribute("href"), label].join("|");
    });
    if (fingerprint !== control.fingerprint) throw new Error("Control changed since observation");
    this.controls.clear();
    if (action.type === "fill_field") {
      if (!control.kind.startsWith("input:") || !labels[action.field].test(control.label) || /checkbox|radio|file|submit/.test(control.kind)) throw new Error("Field mapping rejected");
      const values = { ...demoValues, invoiceReference: this.invoice.reference, customerAccount: this.invoice.accountNumber, amount: this.invoice.amount };
      await control.locator.fill(values[action.field]);
    } else if (action.type === "select_option") {
      const option = control.options?.find(o => o.value === action.value);
      if (!option) throw new Error("Option was not observed");
      const permitted = (/property.*account|service.*account/i.test(control.label) && option.label.includes(this.invoice.accountNumber))
        || (/payment method/i.test(control.label) && action.value === "bank")
        || (/account type/i.test(control.label) && action.value === "checking")
        || (/simulated result/i.test(control.label) && action.value === "success");
      if (!permitted) throw new Error("Option is not permitted by payment policy");
      await control.locator.selectOption(action.value);
    } else if (action.type === "click_element") {
      if (control.kind.startsWith("a:")) {
        const href = await control.locator.getAttribute("href");
        if (!href || !navigationAllowed(new URL(href, this.page.url()).href, this.origin)) throw new Error("Link rejected");
      } else if (!/^(Sign in|Use sample details|Continue|Next)$/i.test(control.label)) throw new Error("Control is not permitted before authorization");
      await control.locator.click();
    }
    await this.page.waitForTimeout(350);
  }
  private async account() {
    // Fixed, same-origin, read-only API. Redirects cannot escape the allowlist.
    if (!navigationAllowed(this.page.url(), this.origin)) throw new Error("Account verification outside mock portal rejected");
    // Fixed application-owned script, never supplied by the model; browser network policy applies.
    const result = await this.page.evaluate(async () => {
      const response = await fetch("/api/account", { redirect: "error", signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Could not independently verify mock account");
      return response.json();
    });
    return accountSchema.parse(result);
  }
  async ready() {
    const body = await this.page.locator("body").innerText();
    if (!body.includes("No money moves") && !body.includes("No money will move")) throw new Error("Mock environment marker missing");
    if (!body.includes(this.invoice.vendorName)) throw new Error("Vendor identity mismatch");
    const data = await this.account();
    const accounts = data.serviceAccounts.filter(a => a.number === this.invoice.accountNumber);
    if (accounts.length !== 1) throw new Error("Customer account is missing or ambiguous");
    const account = accounts[0];
    if (account.propertyName && account.propertyName !== this.invoice.propertyName) throw new Error("Property mismatch; reconcile the portal property before payment");
    this.serviceAccountId = account.id;
    const bills = data.bills.filter(b => b.id === this.invoice.reference && b.serviceAccountId === account.id);
    if (bills.length !== 1 || bills[0].status !== "unpaid" || bills[0].amountCents !== cents(this.invoice.amount)) throw new Error("Invoice balance or status mismatch");
    if (data.payments.some(p => p.billId === this.invoice.reference && p.serviceAccountId === account.id && p.status === "succeeded")) throw new Error("Mock payment already exists");
    const selected = await this.page.locator("select").evaluateAll(elements => elements.filter(e => /property.*account|service.*account/i.test(e.closest("label")?.textContent || e.getAttribute("aria-label") || "")).map(e => ({ label: (e as HTMLSelectElement).selectedOptions[0]?.text || "", value: (e as HTMLSelectElement).value })));
    if (selected.length !== 1 || selected[0].value !== this.serviceAccountId || !selected[0].label.includes(this.invoice.accountNumber)) throw new Error("Wrong customer account selected");
    const form = this.page.locator("form").filter({ has: this.page.locator('select[name="method"]') });
    if (await form.count() !== 1) throw new Error("Payment form not ready");
    const values = await form.evaluate(el => Object.fromEntries(new FormData(el as HTMLFormElement).entries()));
    if (values.method !== "bank" || values.scenario !== "success" || values.bankName !== demoValues.holder || values.accountType !== "checking" || values.routingNumber !== demoValues.routing || values.accountNumber !== demoValues.fundingAccount || values.confirmAccountNumber !== demoValues.confirmFundingAccount) throw new Error("Fictional ACH details are incomplete or changed");
    const summary = await this.page.locator("dl").evaluateAll(dls => dls.map(dl => Object.fromEntries(Array.from(dl.querySelectorAll("dt")).map(dt => [dt.textContent?.trim(), dt.nextElementSibling?.textContent?.trim()]))));
    if (!summary.some(s => s["Bill number"] === this.invoice.reference && s["Payment fee"] === "$0.00")) throw new Error("Bill summary or fee mismatch");
    const shown = body.match(/Total payment\s*\$([\d,]+\.\d{2})/i);
    if (!shown || cents(shown[1].replace(/,/g, "")) !== cents(this.invoice.amount)) throw new Error("Displayed total differs from approved amount");
  }
  async submit(intentId: string): Promise<VerifiedPayment> {
    if (this.sent || this.armed) throw new Error("Duplicate submission rejected");
    await this.ready();
    this.intentId = z.string().uuid().parse(intentId);
    this.armed = true;
    // This method is only called after the worker has consumed durable human authorization.
    const consent = this.page.getByRole("checkbox", { name: /authorize this simulated one-time ACH/i });
    await consent.check();
    const payment = this.page.waitForResponse(r => r.url() === this.origin + "/api/payments" && r.request().method() === "POST", { timeout: 20000 });
    // Attach rejection handling immediately while the review step executes.
    void payment.catch(() => {});
    const submit = this.page.getByRole("button", { name: /^(Pay \$[\d,.]+|Review payment|Submit payment)$/i });
    if (await submit.count() !== 1) throw new Error("Ambiguous submit control");
    const review = /review/i.test(await submit.innerText());
    await submit.click();
    if (review) await this.page.getByRole("button", { name: "Submit payment", exact: true }).click();
    const response = await payment;
    this.paymentResponse = await response.json();
    this.armed = false;
    const result = z.object({ payment: z.object({ id: z.string(), status: z.literal("succeeded") }) }).parse(this.paymentResponse);
    await this.page.waitForURL(url => url.hash === `#receipt/${result.payment.id}`, { timeout: 10000 });
    const data = await this.account();
    const receipt = data.payments.find(p => p.id === result.payment.id && p.billId === this.invoice.reference && p.serviceAccountId === this.serviceAccountId && p.status === "succeeded" && p.amountCents === cents(this.invoice.amount));
    const bill = data.bills.find(b => b.id === this.invoice.reference && b.serviceAccountId === this.serviceAccountId);
    if (!receipt || bill?.status !== "paid") throw new Error("Receipt could not be independently verified");
    const visible = await this.page.locator("dl").evaluateAll(dls => dls.map(dl => Object.fromEntries(Array.from(dl.querySelectorAll("dt")).map(dt => [dt.textContent?.trim(), dt.nextElementSibling?.textContent?.trim()]))));
    if (!visible.some(s => s["Confirmation number"] === receipt.id && s["Bill number"] === this.invoice.reference && s["Status"] === "Completed" && cents((s["Amount"] || "").replace(/[$,]/g, "")) === receipt.amountCents)) throw new Error("Displayed receipt mismatch");
    return { confirmation: receipt.id, billId: receipt.billId, serviceAccountId: this.serviceAccountId, accountNumber: this.invoice.accountNumber, amountCents: receipt.amountCents, status: "succeeded", portalOrigin: this.origin };
  }
  async close() { await this.browser.close(); }
}
