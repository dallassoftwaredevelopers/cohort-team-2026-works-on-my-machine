# Development workflow

Read [root instructions](../../AGENTS.md), [frontend instructions](../../frontend/AGENTS.md) and the matching [code pattern](../code-patterns/index.md). These instructions apply across coding assistants; they do not authorize remote changes.

## Git and review

- Verify repository root, branch, status and commits before edits. Preserve tracked/untracked local work and older stashes. Integrate current main into a feature branch only when authorized; inspect conflicts involving authorization, security, money checks or persistence before resolving.
- Keep implementation, context/documentation and unrelated experiments in separate focused commits. Stage explicit paths, not another contributor's local script edits. Restore preserved work and check its content/fingerprint before finishing.
- Explain the problem, final behavior, Jira mapping, validation and limits in the PR. The earlier read-only OpenRouter/Playwright experiment is historical groundwork, not a runtime dependency that must be merged first.
- Do not push, create/update remote PRs, merge into main, deploy or modify remote/production configuration without applicable explicit authorization. The current preparation task authorizes local synchronization and a separate context commit only.
- At least one formal teammate approving review is required before merge under the [README collaboration/Done guidance](../../README.md). A positive comment or local passing suite is not approval. Verify repository protections; do not assume them.

## Exact existing commands

Run from [frontend/](../../frontend/). These commands are defined in [package.json](../../frontend/package.json); do not invent aliases.

| Command | Purpose |
|---|---|
| `npm ci` | Install locked dependencies |
| `npx playwright install chromium` | Install Chromium for the checked-in browser tests |
| `npm test` | All Node/tsx invoice, document, event and payment tests |
| `npm run test:payments` | Payment policy, protocol, Chromium and PGlite tests |
| `npm run typecheck` | Generate Next.js route types and run TypeScript without emitting |
| `npm run lint` | ESLint |
| `npm run build` | Standard production build; it is not a deployment |
| `npm run dev` / `npm run start` | Development / built web server |
| `npm run payment:worker` | Persistent browser worker with its ignored environment file |

The full existing validation suite is `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. `npm test` already includes relevant Playwright Chromium tests; do not claim a separate checked-in Playwright Test runner or mobile test command. Manual scripts under `frontend/scripts/` can call live services, consume credits and launch browsers; inspect them before any explicitly authorized run. They are not part of automated payment acceptance.

## Test and security discipline

Use intercepted fictional portal traffic and an isolated test database. Do not initiate real payments or paste credential, account, invoice/customer or personal values into context/PR docs. Document configuration names, never secrets. Keep service-role/model keys in the worker environment and never use a `NEXT_PUBLIC_` secret. Review source imports, changed files, ignored environment files and generated client assets without printing secret values. Existing tracked public Supabase configuration does not establish a safe test backend.

Use server-side authentication plus database permissions/transaction guards for writes, not UI gating alone. Preserve model schema/action restrictions, exact account checks, explicit authorization, duplicate handling and receipt verification. Never broaden the allowlist, weaken production guards, or clear `needs_review` as a shortcut to a passing demo.

For migrations, test the full existing chain against a disposable database before rollout. The current PGlite dependency fixture is not a substitute for Supabase Auth/RLS/PostgREST/audit integration. Record real races, worker restarts, cancellation/expiration and uncertain-submit recovery separately from simulated unit tests.

For documentation-only changes, validate every local Markdown link/path, instruction consistency and code/source accuracy. If runtime code/configuration changes, rerun the relevant tests and full checks as appropriate. Keep prior evidence distinct from fresh validation; a WebKit viewport smoke check is not physical-iPhone end-to-end verification.

## Definition of Done and acceptance

Use [DC-65](https://one-atlas-duuf.atlassian.net/browse/DC-65), [DC-49](https://one-atlas-duuf.atlassian.net/browse/DC-49), confirmed decisions and the relevant ticket's acceptance criteria. Applicable requirements include tested success/failure/duplicate/rejection behavior, persisted corrections and results, formal review, merge under team rules, and linked documentation/evidence. A complete deployed fictional workflow and team confirmation remain required for MVP integration; this context commit does not satisfy those criteria.

Before an approved Preview test, verify the Preview target, isolated Supabase backend/migrations, persistent worker, model capability, authentication/redirect settings and tester access. The frontend build does not deploy/run Chromium or certify environment safety. Follow the [manual iPhone acceptance steps](../PLANS/ai-payment-preview-validation.md) after the team approves the test environment. Real-money execution and production rollout are outside this mock-only work.
