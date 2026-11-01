# Code Patterns

Reference docs for how we write code in `frontend/`. **Read the relevant doc before adding a page, a component or data access.** If the code and a doc disagree, raise it. Don't quietly pick one.

| Doc | Read it when you are… |
|---|---|
| [nextjs-server-client.md](./nextjs-server-client.md) | Creating a page or component, deciding server vs. client, naming `.client.tsx` files, writing mutations / Server Actions, choosing how to fetch |
| [supabase-data-fetching.md](./supabase-data-fetching.md) | Reading or writing Supabase data, checking auth, choosing between the server and browser clients, using realtime |
| [list-new-edit-routes.md](./list-new-edit-routes.md) | File map and request flow for the Vendors, Invoices, and Users list, add, and edit pages |

## Ground rules (summary)

1. Pages and layouts are Server Components. Fetch on the server, render interactivity on the client.
2. Client components live in `*.client.tsx` files with `"use client";` as the first line.
3. Use `@/utils/supabase/server` on the server and `@/utils/supabase/client` in `.client.tsx` files.
4. Writes go through Server Actions that check auth and call `refresh()`.

**Canonical example:** [`frontend/app/properties/test/`](../../frontend/app/properties/test/)

## Adding a pattern doc

- One topic per file, in kebab-case: `topic-name.md`
- Start with the versions the doc applies to (check `frontend/package.json`)
- Point to a real example in the codebase
- Add a row to the table above
