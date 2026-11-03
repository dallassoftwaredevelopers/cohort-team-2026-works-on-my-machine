# AI mock payment agent

Status: Implemented for local review. Automated verification passes; live OpenRouter and application-database end-to-end verification require local credentials and migration rollout.

## Current state and integration

This feature branch already stores invoice statuses and vendor customer accounts and opens payment URLs. It predates the newer confirmation migrations on main; the agent migration therefore creates its private schema and invoice confirmation column if absent. Existing read-only vendor experiment files are preserved. The new invoice payment page adds a separate prepare/authorize/verify workflow without changing extraction or approval rules.

The existing ten mock vendor portals expose a common `/api/login`, read-only `/api/account`, and `/api/payments` contract. Their UI discovers the selected service account. Reset controls are scoped to that account, remove its bills/history, and restore one unpaid bill with a new due date. Resetting is developer test setup, never a model capability.

The same browser executor and tool schema run across vendors. There are no vendor-specific selectors or navigation scripts. The verifier deliberately depends on the mock portals' shared API and payment-form contract; an unrelated portal must implement an audited verification contract before being added. This is a bounded mock proof of concept, not unrestricted financial automation.

## Architecture

1. An authenticated Server Action validates the vendor/URL and queues an approved invoice through a transactional RPC.
2. A local Node worker claims one job with a lease. A frozen database snapshot supplies vendor, customer account, property, invoice reference, and USD amount.
3. An isolated Chromium context observes visible controls and relevant page text. Each observed control receives a temporary ID and a fingerprint.
4. OpenRouter requests one schema-validated action at a time. The executor supplies authoritative values for field references and returns results to the model. Page text is untrusted.
5. The executor independently checks the selected account, portal property, unpaid bill, amount, zero fee, and fictional ACH fields before entering `awaiting_authorization`.
6. The signed-in user reviews the frozen details and explicitly authorizes one mock payment. Approval/autopay alone cannot submit.
7. The worker revalidates, atomically consumes authorization, and enables one exact payment request. The request body must match the bill, account, and fictional instrument. Its request ID is replaced with the durable job UUID.
8. The worker checks the response, displayed receipt, and account API payment/bill records. A worker-only RPC atomically records the receipt and marks the invoice paid.

Job states: `queued`, `preparing`, `awaiting_authorization`, `authorized`, `submitting`, `confirmed`, `failed`, `cancelled`, `expired`, `needs_review`. Navigation/observation/action steps are recorded in the job history. Authorization expires after ten minutes. Worker heartbeat leases last sixty seconds.

The browser network gate permits exact same-origin static resources, read-only account retrieval, the fixed demo login, and one authorized payment request. Cross-origin requests, frames, websockets, downloads, reset/bill creation requests, unexpected POSTs, and model JavaScript are blocked. Exact origins are fixed in `policy.ts`; model URLs cannot extend them.

## Target files

- `frontend/lib/payments/`: contracts, policies, OpenRouter client, browser executor, bounded orchestration, and automated tests.
- `frontend/scripts/payment-worker.ts`: standalone worker; secrets stay in its environment.
- `frontend/app/invoices/payment-actions.ts`, `PaymentAgent.client.tsx`, `[id]/payment/page.tsx`: authenticated preparation, cancellation, explicit authorization, polling, and history.
- `frontend/app/invoices/InvoiceForm.client.tsx`: one link to the payment page.
- `frontend/supabase/migrations/20261103000000_mock_payment_agent.sql`: durable jobs/steps, RLS/grants, row locks, partial uniqueness, leases, transitions, invoice/vendor guards, and verified finalization.
- `frontend/package.json`, lockfile, `.env.example`: dependencies and local worker command.

## Local setup

Use a disposable Supabase test project or local Supabase. Apply the existing migrations followed by `20261103000000_mock_payment_agent.sql` using the team's normal migration process. This change does not apply migrations to any remote database automatically.

In `frontend/`:

```powershell
npm ci
npx playwright install chromium
```

Set the Next.js server environment (`.env.local`, ignored):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-test-publishable-key>
MOCK_PAYMENT_AGENT_ENABLED=true
```

Create an ignored `frontend/.env.payment-agent`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<local-test-service-role-key>
OPENROUTER_API_KEY=<your-key>
OPENROUTER_MODEL=<exact-tool-capable-model-id>
PAYMENT_HEADLESS=true
```

The worker verifies the model's `tools` capability against OpenRouter's model catalog before claiming jobs. Provider routing requires support for the requested tool parameters. No implicit model fallback is configured. Do not paste keys into chat or put secrets in `NEXT_PUBLIC_` variables.

Start the app and worker in separate terminals:

```powershell
npm run dev
npm run payment:worker
```

For the ten PDF samples, use the exact vendor names from `policy.ts`, their customer account numbers, `BILL-1001`, and their amount due. Configure the application's property name to match the portal's property (for the legacy Alder Creek account, `Industrial Commons`), not the billed customer's business name. Customer account and fictional ACH funding account are separate fields.

Open an approved invoice, choose **AI mock payment and history**, then **Prepare mock payment**. When ready, review and authorize. The worker fills/checks the portal's ACH consent only after application authorization. No live submission is needed to exercise the offline tests.

Demo sign-in: `demo@acme.com` / `demo123`. Supported payment instrument for this increment is one-time checking ACH: Demo Business, routing `110000000`, account `000123456789`. Card support is intentionally deferred. The worker never uses real financial details.

## Failure handling and reconciliation

- Failed preparation leaves the invoice approved and allows a new recorded job.
- Cancellation is available before submission and invalidates authorization.
- After submission starts, any timeout, ambiguous response, or failed receipt check enters `needs_review`; automatic retry and new intents are blocked.
- On worker loss, a later claim sweeps expired leases. Preparation becomes failed; submission becomes `needs_review`. Run a worker to perform this sweep after a crash.
- Do not reset a portal to resolve an uncertain application payment. First compare portal history, bill status, account, amount, and receipt. A reviewed reconciliation operation is future work; this increment deliberately provides no UI override to clear uncertain jobs.
- Active jobs prevent invoice modification/reopening/manual confirmation and vendor name/account/archive changes. Invoices confirmed by the agent become read-only. The existing invoice workflow remains available for invoices without an active agent job.
- Mock accounts are shared online. Reset only the intended service account; it invalidates prior portal evidence. Test resets never alter the application's payment history automatically.

## Verification

```powershell
npm test
npm run lint
npx next typegen
npx tsc --noEmit
npm run build
```

Tests use the existing Node/tsx runner. Chromium tests intercept all portal traffic and cover three layouts (including review and reordered fields), policy rejection, idempotency, and verified receipts. PGlite tests execute the actual migration against an isolated PostgreSQL schema, exercising permissions, authorization, protected fields, finalization, and lease recovery. The schema fixture represents only dependencies needed by this migration; a full Supabase rollout remains an integration check.

Validation on this branch:

- Automated suite: 27 tests passed in this feature-branch checkout, including its existing invoice extraction tests.
- ESLint and TypeScript passed.
- `next build --webpack` passed in this checkout after transfer. The standard `npm run build` (Turbopack) also passed during the preview-readiness review.
- Live Alder Creek preparation passed with a scripted planner using the real executor and independent verifier. It stopped ready; no payment was submitted.
- A live model-backed run and full application/Supabase submission have not been performed. OpenRouter credentials and a configured disposable application database are required.

## Phases and remaining decisions

- [x] Inspect the application, PDFs, reset flow, payment form, receipt, and public mock API contract.
- [x] Implement restricted execution, OpenRouter tool loop, deterministic verification, and local worker.
- [x] Add durable jobs, explicit authorization, duplicate guards, receipt finalization, and UI/history.
- [x] Run offline browser/PostgreSQL tests and preparation-only live smoke verification.
- [ ] Configure the local test database and exact tool-capable OpenRouter model.
- [ ] Apply/review migration in that disposable environment and run the real model end to end with explicit per-payment authorization.
- [ ] Team review before merge or deployment.

The mock feature is disabled in Vercel production even if its feature flag is set. Authorization deadlines use UTC text to avoid server/iPhone hydration differences. Account verification matches the exact service-account ID, not only account-number text.

No additional architecture approval is required for the authorized local implementation. Persistent worker hosting, card payments, multi-property vendor account modeling, unrelated portal contracts, screenshots sent to a vision model, and a reconciliation UI are outside this increment. The current vendor-level account schema limits each vendor record to one configured customer account; this change does not redesign it.

References: [OpenRouter client tools](https://openrouter.ai/docs/guides/features/tool-calling), [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext).
