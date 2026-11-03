# AI mock payment preview validation

Status: Local validation passed. Remote Preview safety and the complete iPhone workflow remain unverified pending Vercel access and a dedicated test database/worker.

## Available commands

Run from `frontend/`:

- `npm test`: all invoice and payment automated tests.
- `npm run test:payments`: payment policies, OpenRouter protocol, Chromium fixtures, and isolated PostgreSQL migration tests.
- `npm run typecheck`: generate Next.js route types and run TypeScript without emitting files.
- `npm run lint`: ESLint.
- `npm run build`: standard Next.js/Turbopack production build.
- `npm run payment:worker`: persistent local worker; requires ignored `.env.payment-agent`.

The existing `scripts/test-vendor-agent.ts`, `test-vendor-browser.ts`, `test-openrouter-model.ts`, and `check-openrouter.ts` are manual experiments, not this feature's automated suite. The user's existing changes to `test-vendor-agent.ts` are preserved and excluded from the feature commit.

## Results (November 3, 2026)

- 33 automated tests passed. Real Chromium executed three offline layouts, including review and reordered controls; payment requests were intercepted and no live payment was initiated.
- Wrong service-account IDs, wrong amounts/vendors, nonzero fees, invalid actions, premature/duplicate submission, worker timeouts, leases, permissions, and receipt finalization were checked.
- TypeScript, ESLint, and the standard production build passed.
- A read-only Playwright WebKit/iPhone 13 smoke test against the built localhost app passed: login controls visible, no horizontal overflow, unauthenticated payment route redirects to login, no page errors. All external browser requests were blocked. This does not replace testing Safari on a physical iPhone.
- Generated client assets contained no configured local secret values. Local public variable names contain no OpenRouter/service-role secrets. Existing tracked `.env` contains Supabase public configuration, not worker credentials; it is not evidence that the configured backend is a disposable test database.

Review fixes: exact service-account ID verification, deterministic UTC authorization timestamps, and a tested production-disable guard for the mock feature.

## Vercel readiness and safety

The Next.js frontend builds for Vercel. The persistent `payment-worker.ts` is a separate process, not a Next.js route and not started by a Vercel frontend deployment. It must run on a separate persistent host (the developer PC is sufficient for preview testing) against the same dedicated test Supabase project.

Before enabling the feature in Preview, verify in Vercel:

1. Project root is `frontend/`, this feature branch is a Preview target, and `main` remains the production branch.
2. Preview `NEXT_PUBLIC_SUPABASE_URL` and publishable key belong to a dedicated test backend. Apply the reviewed migration there only. Do not use the shared/production database by assumption.
3. Set `MOCK_PAYMENT_AGENT_ENABLED=true` only for the intended Preview environment/branch. The feature refuses Vercel production.
4. Keep `OPENROUTER_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in the worker environment only. Neither is needed by the Vercel web app. Never use a `NEXT_PUBLIC_` prefix for secrets or real payment-provider credentials.
5. Configure and run the worker with that same test database and a tool-capable OpenRouter model. Verify its startup before queuing a test job.
6. Check Supabase auth/redirect settings and Vercel deployment protection allow the intended iPhone tester.

Vercel is not connected to this session, the dashboard is signed out, and there is no local Vercel token/project linkage. Therefore Preview variables, database isolation, deployment target and a new feature Preview URL cannot be certified. GitHub reports Vercel success for old commit `68e236f`; that deployment does not contain this implementation. No production deployment or merge was performed.

## Physical iPhone acceptance

Open the confirmed feature Preview URL in Safari. Sign in to the test app; select an approved fictional invoice whose portal account, property, reference and amount match. Prepare the payment and verify it stops awaiting explicit authorization. Test cancellation once. Prepare a fresh attempt, inspect the exact details, explicitly authorize one mock payment, then verify receipt/history, persisted paid state after reload, and duplicate prevention. Confirm no horizontal scrolling and that controls remain usable with the keyboard and after returning from the background. Test an expired authorization and a worker disconnect; an uncertain submission must block retries.

Do not reset a portal to clear an uncertain application outcome. Reconcile receipt/history first. Only fictional one-time ACH is supported. Real transactions and production rollout remain out of scope.

## Branch preparation

The feature branch was 36 commits behind main. The two conflicts (plans index and invoice form) were resolved while syncing main into the feature branch; the PR diff retains only the one-line invoice link integration. Main was not changed. The existing uncommitted vendor-agent script is preserved. No branch push is performed while Vercel environment safety remains unverified.

## Proposed PR

Title: Add restricted AI mock-payment agent with explicit authorization

Description: Approved invoices can be prepared through allowlisted fictional vendor portals using OpenRouter tool calling and a restricted Playwright worker. Submission requires a separate authenticated authorization; independent bill and receipt verification precede the paid transition. Durable jobs, leases, history and duplicate guards preserve uncertain outcomes for review.

Validation: 33 automated tests, TypeScript, lint, standard build, and a read-only WebKit/iPhone-viewport smoke test passed. Full physical-iPhone and live-model Preview acceptance remain pending the verified test environment and persistent worker. No real payments, main merge or production deployment.
