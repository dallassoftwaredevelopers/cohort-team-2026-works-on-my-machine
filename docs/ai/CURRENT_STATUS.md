# Current status

Verified November 3, 2026. This is a dated snapshot; rerun Git checks and relevant validation before relying on it. Implementation baseline: `232139ecaa3c67e4db319c3ef48fb20c5478eeb7` on `feat/ai-mock-payment-agent`. This documentation is committed separately from implementation; use Git for the current context commit hash.

## Synchronization and distinction from the earlier PR

Fetched `origin/main` at `4f76cf9e93994a1dad33183ec2e6f916b1dab76b`. It was already an ancestor of the feature implementation, so merge reported already up to date; no conflicts or new merge commit were needed. The initial uncommitted script and PR-note edits were backed up/stashed separately and restored byte-for-byte without including them in the context commit.

The earlier [PR #41](https://github.com/dallassoftwaredevelopers/cohort-team-2026-works-on-my-machine/pull/41) is the read-only homepage/model experiment at `68e236f`. The local feature contains the more complete browser worker, authorization, verification, persistence and UI implementation. Do not claim the old PR/deployment contains unpublished local commits, or require its experiment scripts as runtime dependencies. Scope decisions about retaining those inherited scripts belong to team review.

## Verified locally

The complete existing suite passed at the implementation baseline: 33 tests (16 invoice/document/event and 17 payment), TypeScript, ESLint and the standard production build. Browser cases use real Chromium with intercepted mock traffic; model protocol cases mock HTTP; PGlite executes the payment migration against a minimal dependency schema. No real payment was initiated.

Previously recorded evidence includes a read-only WebKit/iPhone viewport smoke check and a client-asset scan for the locally configured secret values. These are not a checked-in repeatable mobile suite, general secret certification, or authenticated physical-iPhone acceptance. Earlier live portal preparation used a scripted planner and stopped before submission; it is not a live-model complete payment test.

Implemented: separate authenticated preparation/authorization actions, bounded tool calling, deterministic vendor/account/amount/form checks, one gated simulated submission, receipt verification, durable jobs/steps, duplicate/lease guards and a Vercel-production disable check. See [payment workflow](PAYMENT_WORKFLOW.md) for exact boundaries.

## Outstanding decisions and verification

- Reconcile Jira's NextAuth decision with implemented Supabase Auth, and obtain confirmed authorization/role policy. Shared-role permissions and automatic-approval policy must not be described as approved solely from code.
- Align the older unapproved PRD/API draft with Jira's mock-payment scope; confirm the payment implementation issue/owner without inventing a ticket. Rejection is required by Jira but absent from the current invoice status/action implementation.
- Team-review the worker/migration/security boundaries, inherited experiment scope, and safe operator handling of uncertain outcomes. There is no reconciliation UI or resumable human browser handoff.
- Apply/test the full migration chain in an isolated Supabase environment; validate authenticated app/RPC/model/browser/receipt persistence together. Current minimal PGlite tests do not establish that integration.
- Add/execute real concurrency, authorization-expiry/cancellation, process-crash/lost-response and broader portal-contract tests. Three fixture layouts do not prove all ten live portals.
- Verify Preview database isolation, secrets placement, deployment target, worker host and authentication/access settings. No implementation Preview URL or complete deployment has been verified. No production configuration is changed by this work.
- Complete physical-iPhone Safari acceptance, including authorization, cancellation, receipt reload, duplicate prevention and background/resume behavior. See the [review and manual test report](../PLANS/ai-payment-preview-validation.md).

## Immediate next step

Review this context together with the implementation as a mock-only draft. Resolve the decision discrepancies above, confirm a dedicated test environment and acceptance owner, and obtain explicit approval before publishing local commits or updating PR #41. The [development workflow](DEVELOPMENT_WORKFLOW.md) defines review/Done criteria. Local test success supports team code review, not merge, deployment or MVP completion claims.
