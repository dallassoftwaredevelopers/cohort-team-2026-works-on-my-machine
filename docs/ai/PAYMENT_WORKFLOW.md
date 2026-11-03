# Mock-payment workflow

Implemented locally for review, not verified as a complete deployed workflow. All payments are simulated: **never initiate real payments**. See [project context](PROJECT_CONTEXT.md) for the team-decision gaps and [current status](CURRENT_STATUS.md) for evidence.

## Application and browser worker

1. An approved invoice's UI links to the [payment page](../../frontend/app/invoices/[id]/payment/page.tsx). [Server Actions](../../frontend/app/invoices/payment-actions.ts) authenticate and validate requests; the start action validates the mock vendor and URL before queuing a job.
2. Database RPCs create/return a durable intent and freeze invoice/vendor/account/property fields. Approval and payment authorization remain separate.
3. The [Node worker](../../frontend/scripts/payment-worker.ts) claims one job at a time per process, renews a lease, opens an isolated browser and runs preparation. The browser remains live during the authorization window; it is not persisted or resumed after a crash. Vercel frontend requests do not host/start this worker.
4. [OpenRouterPlanner](../../frontend/lib/payments/openrouter.ts) uses the configured `OPENROUTER_MODEL`, checks catalog tool support at startup and calls `https://openrouter.ai/api/v1/chat/completions`. There is no default model. Each response must contain one valid tool call; tool results/errors return to the model.
5. The [orchestrator](../../frontend/lib/payments/orchestrator.ts) observes and validates one action at a time, with a 35-step/three-minute preparation budget. The model may inspect/navigate, fill approved field references, select permitted options, click permitted preparation controls, request help, or request a readiness check. `finish` cannot declare payment success.

## Deterministic checks and authorization

The [executor](../../frontend/lib/payments/executor.ts) and [policy](../../frontend/lib/payments/policy.ts) enforce exact configured mock origins, temporary control IDs/fingerprints and permitted actions. There is no model JavaScript, arbitrary selector execution or model-chosen funding data. Application-owned read-only scripts observe the page and retrieve the fixed same-origin mock account API.

Before readiness, code verifies vendor/origin, exact customer/service-account identity, invoice reference, unpaid bill, amount in integer cents, rendered total, zero fee and the fixed fictional ACH fields. Property name is compared when the mock API supplies it. Customer billing account and funding instrument are distinct. This is not independent validation of PDF accuracy; it compares the approved application record with the portal contract.

Preparation reaches `awaiting_authorization`. The user must inspect the details and explicitly authorize one mock payment. Any authenticated user can currently authorize under the implemented shared-role policy; four-eyes separation is absent. The ten-minute window and unchanged snapshot are checked by database transitions. Intake approval/autopay does not authorize submission.

After revalidation and the authorized -> submitting transition, the worker fills the portal consent and clicks the final control (including a review step when present). The request gate permits only one matching mock-payment request and replaces its request ID with the durable job UUID. Unexpected mutations, cross-origin requests, frame navigation, websockets and downloads are blocked. This is browser request policy, not an operating-system network sandbox.

## Portal contract and evidence

The worker depends on the supplied mock sites' shared contract: `/api/login`, read-only `/api/account`, and `/api/payments`, plus their common form and receipt semantics. These are **vendor portal endpoints**, not new Next.js API routes. Registering an origin does not prove a site's contract or idempotency; audit and test before expansion.

After simulated submission, code compares the response, displayed receipt and read-only account payment/bill records. A worker-only finalization RPC checks receipt fields against the frozen snapshot and atomically records confirmation and `paid`. The database trusts the privileged worker's verification; it does not contact the portal or validate a cryptographically signed receipt itself.

## Persistence and uncertainty

The [payment migration](../../frontend/supabase/migrations/20261103000000_mock_payment_agent.sql) defines `payment_agent_jobs` and `payment_agent_steps`, RLS/grants, partial uniqueness, row locks, leases, authorization timestamps, transition RPCs and invoice/vendor guards. Retries after failed/cancelled/expired preparation create new jobs; active/uncertain/confirmed intents block duplicate work. The UI shows the newest job and its latest 100 stored steps, not a full paginated history of every attempt.

Job states are `queued`, `preparing`, `awaiting_authorization`, `authorized`, `submitting`, `confirmed`, `failed`, `cancelled`, `expired`, `needs_review`. Invoice states remain separate. Active jobs prevent conflicting invoice/relevant vendor changes. Existing audit/paid-record protections remain in force.

A post-submit failure or lost submitting lease enters `needs_review`; do not automatically retry. Stale-lease recovery runs when a worker claims work, not on an independent scheduler. No reconciliation UI exists. `request_human_help` stops preparation as failed; resumable browser/MFA/CAPTCHA handoff is not implemented. Never reset a portal to conceal or clear an uncertain application outcome.

## Configuration and rollout boundary

Names are verified in [environment placeholders](../../frontend/.env.example), [config](../../frontend/lib/payments/config.ts) and the worker; no values or credentials belong in shared context.

- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `MOCK_PAYMENT_AGENT_ENABLED`.
- Worker: the same database URL, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`; optional `PAYMENT_HEADLESS`. The existing worker command reads ignored `.env.payment-agent`.
- `VERCEL_ENV` is checked to disable the mock feature/worker in Vercel production. The web feature defaults off. A guard does not prove Preview database isolation or approve deployment.

Run against a separately verified, isolated test Supabase project with reviewed migrations and a persistent worker. Keep worker secrets server-side and out of the Vercel frontend/client bundle. Only fixed fictional one-time checking ACH is supported; cards, real portals and vision/screenshot tools are not implemented. Use the [existing plan](../PLANS/ai-browser-payment-agent.md) for additional setup and [development workflow](DEVELOPMENT_WORKFLOW.md) for validation.
