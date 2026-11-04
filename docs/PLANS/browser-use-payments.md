# Browser Use demo payments

Status: implemented; apply the migration and configure the API key before a live test.

## Setup

1. Run `npm install` from `frontend/` to install the Workflow SDK. Use Node 22 or newer, as required by the existing Supabase dependency.
2. Apply `20261104000000_browser_use_invoice_payments.sql` and `20261104010000_payment_processing_and_background.sql` with `npx supabase db push` from `frontend/`. If the first migration is already applied, only the second will run.
3. Set `BROWSER_USE_API_KEY` and `SUPABASE_SECRET_KEY` in the frontend's local environment file. The latter is the Supabase project secret key (`sb_secret_...`); a legacy service-role key can instead be provided as `SUPABASE_SERVICE_ROLE_KEY`. The worker needs elevated server access because it has no user's session. Never prefix either key with `NEXT_PUBLIC_`. Restart the development server.
4. Add both variables to the Vercel project that runs this Next.js application, for the environments in which payments should run, and redeploy. Enable **Fluid compute** and **access to System Environment Variables** in that project so Workflow can identify the deployment and use Vercel's durable queue. A variable on a different backend project is not available to this app. Workflow uses Vercel's managed infrastructure without an additional scheduling service or recurring cron job.
5. Use an approved invoice with a vendor account number, matching invoice number and amount, and one of the ten cohort demo URLs. Currency is USD; the schema currently has no invoice currency column.
6. Test one payment, navigate to the invoice list, and verify its processing pill changes to disappearance after settlement. Check the Browser Use receipt/history, then open the paid invoice directly to inspect its confirmation.

The migrations can be applied before the keys are configured. Without both keys, automated payment does not start; manual payment remains available on approved invoices. Key rotation requires changing the corresponding server environment variable and redeploying/restarting. Local background execution requires the development server to remain running, but the user's browser can close. On Vercel the workflow continues independently of the user. Inspect workflows in the Vercel dashboard or locally with `npx workflow inspect runs`.

## Flow and files

The Next.js server calls Browser Use Cloud API V4 using HTTP; Python, Chrome, Playwright, and a separate application server are not required.

| File | Responsibility |
|---|---|
| `frontend/lib/invoices/payment.ts` | Shared JSON contract, generic prompt, exact decimal comparison, and the ten permitted demo hosts |
| `frontend/lib/invoices/browser-use.ts` | Server-only authenticated API calls; output schema; short HTTP timeouts; no automatic POST retries |
| `frontend/lib/invoices/reconcile-payment.ts` | Receipt checking and idempotent settlement shared by interactive and background checks |
| `frontend/lib/invoices/payment-worker-client.ts` | Server-only Supabase service client, without user cookies |
| `frontend/workflows/invoice-payment.ts` | Durable background polling with suspended waits between checks |
| `frontend/workflows/invoice-payment-steps.ts` | Provider reads, transactional worker settlement, and cache invalidation |
| `frontend/app/invoices/payment-actions.ts` | Authenticated start, status reconciliation, and manual resolution actions |
| `frontend/app/invoices/DemoPayment.client.tsx` | Start/check controls, progress polling, and resolution form |
| `frontend/app/invoices/actions.ts` | Starts payment after creation/approval when the vendor has autopay enabled and the API key is configured |
| `frontend/app/invoices/[id]/edit/page.tsx` | Server-loads the latest attempt and configuration flag; passes neither the key nor expected snapshot to the browser |
| Migration | Payment attempt records, RLS/grants, reservation and settlement functions, invoice lock while unresolved |

Automatic launch occurs after new-invoice approval or manual approval, only for autopay vendors. Existing approved invoices are not swept or paid on page load. Any approved invoice can also be explicitly started using **Run demo payment**. These actions follow the existing signed-in invoice permissions; separate Clerk/Approver restrictions remain outside this increment.

The database reserves the invoice and changes it to **Payment Processing** in the same transaction, before the external request. Concurrent starts return the same active attempt. The server queues a durable watcher before sending the Browser Use create request; a scheduling failure leaves no external payment to retry and returns the invoice to approved. Each attempt snapshots account, reference, amount, URL, and currency so later vendor edits cannot change what a completed task is compared against. Failed attempts remain as separate records when retried.

The generic prompt uses onsite demo credentials/cards, checks existing history, requests at most one submission, and returns the agreed JSON. The API receives an `outputSchema`; the server independently validates the shape and every identity/amount field before settlement. A success and the existing `save_invoice_payment_confirmation` call commit in one transaction. Invoice audit triggers record processing and paid transitions. Interactive settlement uses its signed-in actor; background settlement uses a service-role-only function that restores the initiating user as the audit actor. Payment attempts retain operational messages/results separately. Normal signed-in users cannot call the background function or write payment-attempt rows directly.

Account/invoice identifiers may be verified on earlier pages in the same payment flow if the receipt omits them. The confirmation, amount and currency come from the receipt/payment history. The agent must never fill an unobserved identifier using the expected values supplied in its prompt. Missing identifiers still require review. Mismatch messages identify each field and show its expected/returned value, rather than treating missing account details as an unexplained mismatch. Existing uncertain tasks can be rechecked to display the improved diagnostics without starting another payment; an updated prompt affects new tasks only.

Each run requests a $0.50 model-cost cap (`maxCostUsd`); browser/network costs are additional and provider enforcement is not a hard total-spend guarantee. No model override is sent. The API key and upstream error bodies are never returned to the browser. The demo URL restriction applies at launch; the prompt also instructs the agent to stay on that site. This is not a network-level restriction on all agent navigation.

## Completion and recovery

The Workflow SDK checks the saved attempt every 15 seconds using durable `sleep`, fetching the provider's lightweight status endpoint and the full result only after completion. Waiting consumes no continuously running function. Browser Use task creation is outside the workflow: replay and step retries can repeat only reads and idempotent settlement, never submit another external task. The worker retries transient failures with backoff; repeated failure or approximately 45 minutes without completion moves the attempt to uncertain and keeps the invoice locked for review. A prolonged database outage can still prevent that final write; inspect the workflow and resume checks from the edit screen after service recovery.

The edit screen can also check progress, using the same reconciliation function. Navigation stops only those optional browser checks. The hosted agent and durable worker continue and can mark paid without another page visit. Visible invoice list/dashboard pages refresh every 15 seconds while they contain processing invoices, showing the new label and removing paid rows automatically. Payment Processing uses the approved/paid field locks, with no manual Pay, archive, or reopen controls. A definite no-submission failure returns to Approved for correction or an explicit retry; an uncertain attempt stays Payment Processing until reviewed.

Workflow integration wraps `next.config.ts` with `withWorkflow`, generates internal `/.well-known/workflow/` routes, and excludes that exact route prefix from the application login proxy as the SDK requires. These are SDK-managed execution endpoints, not public application pages; all user-facing pages and payment actions retain their auth checks. Generated routes and local `.workflow-data/` state are ignored by Git. Existing processing attempts predating the worker are not swept automatically; an explicit start on the existing reservation queues a watcher without creating a new Browser Use task.

An HTTP create timeout, remote failure/cancellation, malformed output, or mismatched details yields an uncertain attempt. Status-read outages leave a running attempt intact. A starting attempt without a saved task ID becomes uncertain after 90 seconds when checked. None of these cases automatically starts another task. A definite API rejection, or a valid agent `failed` result explicitly reporting no submission and no confirmation, allows an explicit retry.

Unresolved attempts block invoice changes, including archive, reopen, and manual confirmation. For uncertain attempts, open Browser Use, confirm the task is stopped, and check the site's payment history. The resolution form requires that acknowledgment and a review note. Enter a verified confirmation to mark paid, or leave it blank only after verifying no payment occurred; that releases the invoice for retry/correction. If a saved task ID is present, the server also checks that the run is terminal before allowing resolution. Missing-ID cases require locating/stopping the task manually in Browser Use.

If the create response includes a task ID but saving it fails, the UI displays that ID; do not launch another payment. The reservation remains in place. No API idempotency behavior is assumed: the application reservation protects starts, and the app never blindly retries an ambiguous POST. This cannot guarantee exactly-once external payment; the receipt/history check and uncertain-state review handle ambiguity.

## Validation and follow-up

Use mocked agent results for success, mismatched identity/amount, malformed JSON, no-submission failure, uncertain outcome, HTTP rejection, lost responses, and status-read outages. Exercise the real migration against isolated PostgreSQL for auth, reservation, settlement rollback, paid immutability, and conflicting invoice changes. A real Browser Use call requires the user's configured key and consumes credits.

Follow-up: add distinct invoice-role permissions when agreed. AI extraction replacement remains separate.

API reference: [V4 quickstart](https://docs.browser-use.com/cloud/agent/quickstart), [structured output](https://docs.browser-use.com/cloud/agent/structured-output), [OpenAPI schema](https://docs.browser-use.com/cloud/openapi/v4.json).

Background reference: [Workflow Next.js setup](https://workflow-sdk.dev/docs/getting-started/next), [deployment and local execution](https://workflow-sdk.dev/docs/deploying).
