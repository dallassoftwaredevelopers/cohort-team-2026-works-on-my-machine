# Next.js Server / Client Pattern

> **Reference doc.** Follow this pattern for every new page and component in `frontend/`.

**Versions (from `frontend/package.json`):** `next` 16.4.2 · `react` / `react-dom` 19.3.0

**Enabled in `frontend/next.config.ts`:** `cacheComponents: true`, `partialPrefetching: true`

**Canonical example:** [`frontend/app/properties/test/`](../../frontend/app/properties/test/)

This is Next.js 16. If you are an AI agent, read the matching guide in `frontend/node_modules/next/dist/docs/` before writing code (see [`frontend/AGENTS.md`](../../frontend/AGENTS.md)). Patterns from Next 13–15 (`middleware.ts`, synchronous `params`, `cookies()` without `connection()`) are wrong here.

---

## The rule

1. **Pages and layouts are Server Components.** Never put `"use client"` in `page.tsx` or `layout.tsx`.
2. **Fetch data on the server** and pass it down as props.
3. **Push `"use client"` down to the smallest leaf** that needs interactivity.
4. **Client component files are named `*.client.tsx`**, and their **first line** is `"use client";`.

```
app/properties/test/
├── page.tsx                    ← Server Component: auth check + data fetch
└── PropertySelect.client.tsx   ← Client Component: renders + handles onChange
```

### `page.tsx` (server)

```tsx
// Reference pattern: keep the page static, and fetch inside a <Suspense>-wrapped Server Component
// with the server Supabase client, then pass the data to a small client component only for interactivity.
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import PropertySelect from "./PropertySelect.client";

export default function PropertiesTestPage() {
  return (
    <Suspense fallback={<p>Loading properties…</p>}>
      <Properties />
    </Suspense>
  );
}

async function Properties() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return <p><Link href="/login?next=/properties/test">Sign in to view properties</Link></p>;
  }

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name")
    .order("name");
  if (error) throw error;

  return <PropertySelect properties={properties ?? []} />;
}
```

### `PropertySelect.client.tsx` (client)

```tsx
"use client";

export type Property = { id: string; name: string };

export default function PropertySelect({ properties }: { properties: Property[] }) {
  return (
    <select name="property_id" defaultValue="" onChange={(e) => console.log(e.target.value)}>
      <option value="" disabled>Choose a property</option>
      {properties.map((property) => (
        <option key={property.id} value={property.id}>
          {property.name}
        </option>
      ))}
    </select>
  );
}
```

Why this shape works:

- The data is in the HTML on first paint. There is no loading spinner, no `useEffect` fetch and no request waterfall.
- Only `PropertySelect` ships JavaScript. The page's code stays on the server.
- Auth runs on the server, before any data is sent to the browser.

---

## Naming and directive conventions

| Rule | Example |
|---|---|
| Client component file ends in `.client.tsx` | `PropertySelect.client.tsx`, `upload.client.tsx` |
| `"use client";` is the **first line**, above the imports | see above |
| Import it without the `.tsx` extension | `import PropertySelect from "./PropertySelect.client";` |
| Server files get no suffix and no directive | `page.tsx`, `layout.tsx`, `PropertyList.tsx` |
| Server Actions go in a file whose first line is `"use server";` | `actions.ts` (next to the page that uses them) |

`"use client"` marks a **boundary**: everything the file imports also goes into the client bundle. So keep `.client.tsx` files small, and don't import server-only modules (`@/utils/supabase/server`, `next/headers`, secrets) into them.

---

## What MUST be a Client Component

If a component uses any of the following, it must be in a `.client.tsx` file.

**React hooks that rely on state, effects or context**

- `useState`, `useReducer`
- `useEffect`, `useLayoutEffect`, `useInsertionEffect`
- `useRef` (for DOM refs or mutable values)
- `useContext` and context providers (`createContext`)
- `useTransition`, `useDeferredValue`, `useOptimistic`
- `useActionState`, `useFormStatus` (form pending and error UI)
- `useSyncExternalStore`
- Any custom hook that uses one of these

**Next.js client hooks** (`next/navigation`)

- `useRouter`, `usePathname`, `useSearchParams`, `useParams`
- `useSelectedLayoutSegment(s)`, `useLinkStatus`

**Event handlers**

- `onClick`, `onChange`, `onSubmit`, `onBlur`, `onKeyDown`, etc. Functions can't be passed from server to client as props. The one exception is Server Actions.

**Browser-only APIs**

- `window`, `document`, `localStorage` / `sessionStorage`, `navigator`
- `window.confirm` / `alert`, `FileReader`, `URL.createObjectURL`, clipboard, geolocation
- `IntersectionObserver`, `ResizeObserver`, `matchMedia`

**Interactive third-party UI**

- CoreUI components that keep internal state or take callbacks (modals, dropdowns, toasts, `CForm` with `validated`). Static CoreUI markup such as `CCard` and `CCardHeader` works in Server Components; see `app/invoices/upload/page.tsx`.
- The app shell (sidebar, header, breadcrumb, theme toggle) is in [`components/layout/`](../../frontend/components/layout/). The stateful pieces are `*.client.tsx` files. The root `app/layout.tsx` stays a Server Component and wraps `children` in `AppShell`. The header's account menu is a server component (`components/layout/AccountMenu.tsx`) passed into `AppShell` as the `account` prop inside `<Suspense>`, so the user's email is read on the server and only the dropdown ships JavaScript. Sidebar links live in `components/layout/nav.tsx`. Add a route there, and to `routeNames` for the breadcrumb, when you add a page.

**Supabase work that must happen in the browser**

- `supabase.auth.onAuthStateChange(...)`: listens for sign-in/sign-out in the browser
- Realtime channels (`supabase.channel(...).subscribe()`)
- Anything that has to react instantly to browser auth state without a server round-trip

If a component only receives data and renders markup, it is **not** a client component, even if it is reused. Leave the suffix and directive off.

---

## Mutations: what runs where

A mutation is triggered on the client (a click or a form submit), but **the write runs on the server by default**.

| Mutation | Where the write runs | How |
|---|---|---|
| Create / update / archive rows | **Server Action** (`"use server"`) using the server Supabase client | `<form action={createProperty}>` or call it from a handler |
| Pending / error / optimistic UI around a write | **Client** (`useActionState`, `useFormStatus`, `useOptimistic`) | Inside a `.client.tsx` form |
| Confirm dialogs ("Archive X?") | **Client** (`window.confirm` or a CoreUI modal) | Show the dialog, then call the Server Action |
| File selection / preview / reading a file in the browser | **Client** | `<input type="file">` + `FileReader` in a `.client.tsx` |
| PDF extraction | **Route Handler** (`app/api/invoices/extract/route.ts`), called from the client with `fetch` | Existing invoice upload flow |
| Auth listener, realtime subscriptions | **Client only** (browser Supabase client) | See [Supabase data fetching](./supabase-data-fetching.md) |
| Sign in / sign out | Either side works with `@supabase/ssr`, because both write the session cookie. We use Server Actions. | `app/login/actions.ts` (`signIn` and `signOut`; `signOut` is the Sign out item in `components/layout/AppHeaderDropdown.client.tsx`). Protected pages `redirect("/login?next=<path>")` when `getClaims()` has no claims |

### Server Action template

```ts
// app/properties/actions.ts
"use server";

import { refresh } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type FormState = { error: string; values?: Record<string, string> } | undefined;

// (prev, formData) is the signature useActionState expects
export async function saveProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();

  // Server Actions are public POST endpoints. Always check auth.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a property name.", values: { name } };

  const { error } = await supabase.from("properties").insert({ name }).select("id").single();
  if (error) return { error: error.message, values: { name } };

  refresh(); // re-render the current route so the server fetch picks up the new row
}
```

- Use `refresh()` (from `next/cache`) when the page's data is uncached, which is our default because every Supabase server read goes through `connection()`.
- Use `revalidatePath` / `updateTag` only for data that is wrapped in `"use cache"`.
- `refresh()` can **only** be called inside a Server Action.

---

## Data fetching

### Default: prefetch on the server, render on the client

```
page.tsx (server)  ──fetch──▶  Supabase
      │
      └── props ──▶  Thing.client.tsx  (state, handlers)
```

1. `await` the data in `page.tsx` (or in a server component the page renders).
2. Pass **plain, serializable** data as props: strings, numbers, booleans, plain objects and arrays, `Date`. You can also pass Server Actions.
3. Don't pass class instances, functions (other than Server Actions) or the Supabase client.

### Streaming slow data

With `cacheComponents`, reading cookies (which every server Supabase call does) is **request-time data**. It must render inside a `<Suspense>` boundary **inside the page**. Don't rely on the root [`app/loading.tsx`](../../frontend/app/loading.tsx): it covers a full page load, but on a client navigation it sits above the part of the tree that re-renders, so dev shows "Next.js encountered uncached data during prerendering or a navigation". Keep the page component itself synchronous (static heading, layout) and move auth + fetching into an async child behind `<Suspense>`:

```tsx
import { Suspense } from "react";

export default function Page() {
  return (
    <>
      <h1>Properties</h1>
      <Suspense fallback={<p className="text-body-secondary">Loading…</p>}>
        <PropertyList /> {/* async server component that fetches */}
      </Suspense>
    </>
  );
}
```

You can also start the fetch on the server **without awaiting it**, pass the promise to a client component, and unwrap it there with React's `use(promise)` inside `<Suspense>`. Use this when the client component needs the data but the shell should render first.

### When client-side fetching is OK

Fetch from a client component only when the data **can't be known at render time**:

- It depends on user input after load (typeahead search, filters you don't want in the URL)
- It comes from a browser-only source (realtime, a file the user just picked)
- It polls

Even then, prefer putting filters in `searchParams` so the server can fetch. When you do fetch on the client, cancel stale responses (see the `active` flag pattern in the Supabase doc).

### A full CRUD example

[`app/properties/`](../../frontend/app/properties/) applies this pattern to a whole page with no `useEffect`: `page.tsx` checks auth (redirecting to [`app/login/`](../../frontend/app/login/) when signed out), fetches and renders the list; every write is a Server Action in `actions.ts`; the client leaves (`PropertyForm.client.tsx` and the shared [`components/ArchiveButton.client.tsx`](../../frontend/components/ArchiveButton.client.tsx)) only hold `useActionState` and `window.confirm`. UI state the server needs, such as which property is being edited, lives in a search param (`?edit=<id>`) rather than `useState`. [`app/vendors/`](../../frontend/app/vendors/) follows the same shape.

---

## Checklist for a new page

- [ ] `page.tsx` has no `"use client"`
- [ ] Auth is checked on the server with `getClaims()` before any data is read
- [ ] Data is fetched on the server with `@/utils/supabase/server`
- [ ] Interactive parts are in `*.client.tsx` files that start with `"use client";`
- [ ] Props passed to client components are serializable
- [ ] Writes go through a `"use server"` action that checks auth and calls `refresh()`
- [ ] Request-time data is inside a `<Suspense>` boundary in the page (the root `loading.tsx` doesn't cover client navigations)
- [ ] `npm run lint` passes
