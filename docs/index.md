# Docs

Start here. This index points humans and AI agents to the right doc.

| Doc | What it covers |
|---|---|
| [ai/](./ai/index.md) | Shared agent context, source authority, payment/development workflows and verified status |
| [PRD.md](./PRD.md) | Product requirements: what we're building and why |
| [api-contract.md](./api-contract.md) | API endpoints and request/response shapes |
| [code-patterns/](./code-patterns/index.md) | **How we write code**: the Next.js server/client pattern, Supabase data fetching |
| [PLANS/](./PLANS/index.md) | Implementation plans for upcoming work, with phases and open decisions |

## For AI agents

Read [root AGENTS.md](../AGENTS.md) and [shared context](./ai/index.md) first. Before writing code in `frontend/`:

1. Read [`frontend/AGENTS.md`](../frontend/AGENTS.md). This is Next.js 16, so check the bundled docs in `frontend/node_modules/next/dist/docs/`.
2. Read [code-patterns/index.md](./code-patterns/index.md) and the doc that matches your task.
3. Check versions in `frontend/package.json` rather than assuming them.
