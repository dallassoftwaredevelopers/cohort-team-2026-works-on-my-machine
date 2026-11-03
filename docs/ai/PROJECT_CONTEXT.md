# Project context

Source check: November 3, 2026. Requirements and decisions below were read from Jira; implementation was inspected at `232139ecaa3c67e4db319c3ef48fb20c5478eeb7`. This context does not approve a design or close a ticket.

## Mission and required MVP

Reduce manual invoice processing while retaining human control and an understandable history. [DC-49: Invoice Processing MVP](https://one-atlas-duuf.atlassian.net/browse/DC-49) and [DC-38: application workflow](https://one-atlas-duuf.atlassian.net/browse/DC-38) describe upload -> extract -> review/correct -> approve/reject -> save/reload -> submit mock vendor payment -> record result. The required extraction fields are vendor, invoice reference, amount due and due date. Duplicate and failed payments must be handled safely; approval is not payment success.

Only fictional data and simulated transactions are in scope. Real funds, production banking credentials and real vendor transactions are excluded. An unmatched property must be resolved, not created implicitly by extraction. Configurable automatic approval/Easy Pay is not automatically an approved requirement merely because code exists.

## Confirmed decisions versus current implementation

[DC-40: stack decision](https://one-atlas-duuf.atlassian.net/browse/DC-40) records the October 19 selection of Next.js/React/TypeScript, Next.js server-side TypeScript, Supabase PostgreSQL, CoreUI, Vercel hosting and a TypeScript extractor. It supersedes the separate FastAPI proposal. It names NextAuth for authentication; **current code instead uses Supabase Auth/SSR**. Team reconciliation of that decision is outstanding; do not label Supabase Auth an independently verified replacement decision.

The repository currently uses Next.js 16.4.2, React 19.3.0, CoreUI/Sass, Supabase clients/migrations, and `pdf-parse` with a TypeScript parser. Versions and commands come from [package.json](../../frontend/package.json), not the older PRD's proposed stack.

The OpenRouter/Playwright worker is implemented locally for mock-only team review. Its model choice, persistent hosting and rollout are not established team-approved stack decisions in the sources checked. It is separate from the earlier read-only homepage/model experiment; it does not import that experiment's scripts or older URL helper.

## Requirement and documentation drift

- [PRD.md](../PRD.md) is an October 17 **unapproved draft** that excludes vendor payment. That scope conflicts with the current Jira MVP/workflow above; do not treat it as a prohibition on the authorized mock-only implementation or silently rewrite the PRD.
- DC-40 also records an earlier boundary against vendor submissions. Current DC-38/DC-49 explicitly require fictional vendor payment; that is mock-only scope, not approval of autonomous or real transactions.
- [api-contract.md](../api-contract.md) is a draft manual-entry contract; it is not the full implemented payment API or current status vocabulary.
- [DC-5: roles and permissions](https://one-atlas-duuf.atlassian.net/browse/DC-5) still labels the shared-role matrix as a proposal awaiting review. Current payment actions allow any authenticated user to authorize; separate requester/approver roles are not implemented.
- Current [invoice states](../../frontend/lib/invoices/status.ts) are `created`, `waiting on approval`, `approved`, `paid`. Jira requires rejection, but there is no `rejected` state in this enum or rejection action in the current invoice actions. Do not claim full rejection acceptance.
- Intake automatic-approval rules exist in main, while Jira and the [approval plan](../PLANS/invoice-approval-rules.md) still contain proposal/historical language. Code presence is not evidence of approved autonomy. Payment submission still needs its own explicit authorization.

## Jira traceability

| Source | Role in this work |
|---|---|
| [DC-18](https://one-atlas-duuf.atlassian.net/browse/DC-18) | API/workflow requirements; do not infer concrete REST routes from logical operations |
| [DC-65](https://one-atlas-duuf.atlassian.net/browse/DC-65) | Complete deployed MVP verification and evidence; local tests do not satisfy it |
| [DC-64](https://one-atlas-duuf.atlassian.net/browse/DC-64) | Extraction accuracy/expected-value reporting; does not cover payments |
| [DC-70](https://one-atlas-duuf.atlassian.net/browse/DC-70), [DC-75](https://one-atlas-duuf.atlassian.net/browse/DC-75) | Supabase setup/access history; not proof of current Preview isolation or migration rollout |

DC-65 leaves payment implementation ownership and the integration contract as team questions. Confirm the existing issue mapping before creating another ticket or claiming a dedicated payment issue. Linked issues can change; reread them before assigning or closing work.

## Repository map

- [frontend/app/](../../frontend/app/): Next.js pages, authenticated Server Actions and route handlers for invoices, vendors, properties, users, rules and events.
- [frontend/lib/invoices/](../../frontend/lib/invoices/), [lib/events/](../../frontend/lib/events/): extraction/status/document helpers and event lookup tests.
- [frontend/lib/payments/](../../frontend/lib/payments/): model/tool contracts, allowlist, executor, orchestrator, verifier logic and payment tests.
- [frontend/scripts/](../../frontend/scripts/): persistent payment worker and separate manual experiments.
- [frontend/utils/supabase/](../../frontend/utils/supabase/): server/browser/session clients; [proxy.ts](../../frontend/proxy.ts) refreshes sessions.
- [frontend/supabase/migrations/](../../frontend/supabase/migrations/): schema, policies, transaction functions, audit and status protections.
- [frontend/components/](../../frontend/components/), [styles/](../../frontend/styles/): shared UI/CoreUI/Sass.
- [docs/code-patterns/](../code-patterns/index.md) and [docs/PLANS/](../PLANS/index.md): established implementation conventions and plans.
