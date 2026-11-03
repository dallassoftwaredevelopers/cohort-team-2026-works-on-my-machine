<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared repository instructions

Read [../AGENTS.md](../AGENTS.md) first; it is the primary shared policy for all agents. This file adds frontend-specific conventions and retains the generated Next.js guidance above. Shared project and payment context starts at [../docs/ai/index.md](../docs/ai/index.md).

## Project docs

All project docs live in the repo-root `docs/` folder (`../docs/` from here). Each folder has an `index.md` that lists what's in it, so read the index first rather than assuming a doc exists.

- **[`../docs/`](../docs/index.md)**: start here
- **[`../docs/code-patterns/`](../docs/code-patterns/index.md)**: how we write code. Read the relevant pattern before adding pages, components, or data access.
- **[`../docs/PLANS/`](../docs/PLANS/index.md)**: implementation plans

### Writing a new doc

- Put it in `docs/`, never in `frontend/`. Patterns go in `code-patterns/`, plans go in `PLANS/`.
- Use a kebab-case file name: `topic-name.md`.
- Add a row for it to that folder's `index.md`. If you create a new folder, give it an `index.md` and link it from `docs/index.md`.
- Follow the "Adding a …" section in the folder's `index.md`.
- Exception: the explicitly requested shared files under `docs/ai/` use uppercase names as listed in their index; keep those names stable.

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Client component | `*.client.tsx`, with `"use client";` as the first line | `PropertySelect.client.tsx` |
| Server component, page, layout | No suffix, no directive | `page.tsx`, `layout.tsx`, `PropertyList.tsx` |
| Server Actions | `actions.ts` next to the route, `"use server";` as the first line | `app/properties/actions.ts` |
| Route Handlers | `app/api/<resource>/<action>/route.ts` | `app/api/invoices/extract/route.ts` |
| Supabase on the server | `import { createClient } from "@/utils/supabase/server"` | Server components, actions, route handlers |
| Supabase in the browser | `import { createClient } from "@/utils/supabase/client"` | `*.client.tsx` only |
| Request proxy | `proxy.ts` (Next 16 replacement for `middleware.ts`) | `frontend/proxy.ts` |