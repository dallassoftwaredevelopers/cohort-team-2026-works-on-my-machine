# Supabase Data Fetching (Server & Client)

> **Reference doc.** How to read and write Supabase data from `frontend/`, and which helper to use where.

**Versions (from `frontend/package.json`):** `@supabase/ssr` ^0.12.7 · `@supabase/supabase-js` ^2.118.0 · `supabase` CLI ^2.121.0 (dev) · `next` 16.4.2

**Environment variables** (copy `frontend/.env.example` to `frontend/.env`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Both are public on purpose. Row Level Security (RLS) in Postgres controls access, not the key. Never put a service-role / secret key in a `NEXT_PUBLIC_` variable.

Read [Next.js Server / Client Pattern](./nextjs-server-client.md) first. This doc assumes it.

---

## The three helpers

All three live in [`frontend/utils/supabase/`](../../frontend/utils/supabase/).

| Helper | Import | Use in | Built with |
|---|---|---|---|
| **Server client** | `import { createClient } from "@/utils/supabase/server"` | Server Components, Server Actions, Route Handlers | `createServerClient` + `cookies()` |
| **Browser client** | `import { createClient } from "@/utils/supabase/client"` | `*.client.tsx` files only | `createBrowserClient` |
| **Session refresh** | `updateSession` from `@/utils/supabase/middleware` | **Only** `frontend/proxy.ts` | `createServerClient` + request/response cookies |

Both clients export a function named `createClient`. **The import path is what tells them apart**, so check it.

### How they fit together

```
Browser request
   │
   ▼
proxy.ts ──▶ updateSession()        refreshes an expired auth cookie on every request
   │
   ▼
page.tsx ──▶ server createClient()  reads the (fresh) cookie, queries as the user, RLS applies
   │
   ▼  props
Thing.client.tsx ──▶ browser createClient()  only for listeners / realtime / browser-only work
```

- `proxy.ts` is the Next 16 replacement for `middleware.ts`. The helper file is still called `middleware.ts` because Supabase's guide uses that name; Next.js never sees the helper's file name.
- `proxy.ts` refreshes the cookie on every request, so the server client's `setAll` can safely swallow the error Server Components throw when they try to set cookies (see the `try/catch` in `server.ts`).

---

## Server: reading data

```tsx
import { createClient } from "@/utils/supabase/server";

export default async function Page() {
  const supabase = await createClient(); // always await; it's async

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return <SignInPrompt />;

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name")
    .order("name");
  if (error) throw error; // caught by the nearest error.tsx

  return <PropertySelect properties={properties ?? []} />;
}
```

Rules:

- **`await createClient()`.** It calls `await connection()` and `await cookies()` internally. `connection()` is required under `cacheComponents`, because Supabase checks token expiry with `Date.now()`, so the call has to happen at request time.
- **Create one client per request.** Never store a server client in a module-level variable.
- **`select` only the columns you render.** Whatever you pass to a client component ends up in the page payload.
- **Handle `error`.** Throw it, or show a message. Don't silently use `data ?? []` when there's an error.
- **Request-time data needs `<Suspense>` inside the page.** `app/loading.tsx` doesn't cover client navigations. See the [server/client doc](./nextjs-server-client.md#streaming-slow-data).
- **Don't use the server client inside `"use cache"`.** It reads cookies, which are per-user and per-request.

### Which auth call to use

| Call | Where | Use it for |
|---|---|---|
| `supabase.auth.getClaims()` | **Server (default)** | Checking that the user is signed in and reading their id/claims. It verifies the JWT signature locally, with no round-trip to the Auth server. Used in `updateSession` (`utils/supabase/middleware.ts`, run by `proxy.ts`) and in every protected page and Server Action. |
| `supabase.auth.getUser()` | Server or client | When you need the full, current user record from the Auth server (e.g. email, metadata). Makes a network call. |
| `supabase.auth.getSession()` | **Client only** | Reads the session from storage **without verifying it**. Never use it to authorize anything on the server. |

The user id is `data.claims.sub`.

---

## Server: writing data (Server Actions)

Writes should go through a Server Action by default:

```ts
// app/properties/actions.ts
"use server";

import { refresh } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function archiveProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");

  // .select().single() makes a blocked or already archived update an error.
  const { error } = await supabase
    .from("properties")
    .update({ deleted_at: new Date().toISOString(), deleted_by: data.claims.sub })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { error: error.message };

  refresh();
}
```

- Server Actions are **public POST endpoints**. Check auth inside every one, even if the UI hides the button.
- RLS still applies, because the server client acts as the signed-in user. Treat the auth check as an early exit and RLS as the real guard.
- **Chain `.select(...).single()` after `update`.** Without it, a write that RLS blocks returns no error and touches 0 rows.
- Archive invoices, vendors, and properties by setting `deleted_at` and `deleted_by`; filter active lists with `.is("deleted_at", null)`.
- Call `refresh()` after a successful write so the page's server fetch runs again. If the URL holds state that should be cleared (e.g. `?edit=<id>` after saving or archiving), `redirect()` to the clean path instead, as `app/properties/actions.ts` does.
- Return `{ error }` for errors the user can fix (show them with `useActionState`). Throw for bugs.

---

## Client: the browser client

Use it **only** in `*.client.tsx` files, and only for things that can't be done on the server (see [what must be client](./nextjs-server-client.md#what-must-be-a-client-component)).

### Creating it

Create the client once per component and keep the same instance across renders:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function Thing() {
  const [supabase] = useState(createClient); // lazy init; same instance every render
  // ...
}
```

### Listening to auth state

```tsx
useEffect(() => {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });
  return () => listener.subscription.unsubscribe(); // always unsubscribe
}, [supabase]);
```

### Fetching on the client (only when needed)

If the data depends on input that only exists after load, guard against stale responses:

```tsx
useEffect(() => {
  let active = true;
  async function load() {
    const { data, error } = await supabase
      .from("properties")
      .select("id, name")
      .ilike("name", `%${query}%`);
    if (!active) return;             // ignore responses for an old query
    if (error) setError(error.message);
    else setResults(data ?? []);
  }
  void load();
  return () => { active = false; };
}, [supabase, query]);
```

Before you write this, ask whether `query` could be a URL search param that the server reads. Usually it can, and that's simpler.

### Realtime

```tsx
useEffect(() => {
  const channel = supabase
    .channel("invoices")
    .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
      router.refresh(); // ask the server component to fetch again
    })
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}, [supabase, router]);
```

Calling `router.refresh()` keeps the server as the single source of the data, so you don't have to rebuild the list by hand on the client.

---

## Quick decision table

| I need to… | Use |
|---|---|
| Show data on a page | Server client in `page.tsx` → props |
| Check that the user is signed in | `getClaims()` on the server |
| Create / update / archive | Server Action + server client + `refresh()` |
| Show pending / error state for a write | `useActionState` in a `.client.tsx` form |
| React to sign-in / sign-out in the browser | Browser client `onAuthStateChange` |
| Live updates | Browser client realtime → `router.refresh()` |
| Search as the user types | URL search params + server fetch (preferred), or browser client with an `active` guard |
| Use a secret / service-role key | A server-only module. Never `NEXT_PUBLIC_`, never a `.client.tsx` file |

## Don't

- Import `@/utils/supabase/server` into a `.client.tsx` file. It pulls `next/headers` into the client bundle, and the build fails.
- Use `getSession()` on the server to authorize.
- Fetch in `useEffect` when the page could have fetched on the server.
- Keep a Supabase client in a module-level variable on the server.
- Skip the auth check in a Server Action because "the page already checked."
