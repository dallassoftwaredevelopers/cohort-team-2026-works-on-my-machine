# List, New, Edit, and Activity Routes

**Applies to:** Next.js 16.4.2, React 19.3.0, and the Supabase server client used in `frontend/`.

The Vendors feature established the list → new/edit structure. Invoices follows it and reuses a single form for creation and editing, with an optional PDF extraction step. Users follows the same navigation and page layout, with a separate creation path because a new account is created in Supabase Auth. Activity (`/events`) is a read-only page for the audit history produced by invoice, vendor, and property writes. Read [Next.js Server / Client Pattern](./nextjs-server-client.md) and [Supabase Data Fetching](./supabase-data-fetching.md) for the underlying conventions.

## File map

```text
frontend/app/
├── api/invoices/extract/route.ts  POST /api/invoices/extract: parse a selected PDF
├── api/events/search/route.ts     Authenticated autocomplete search for Activity filters
├── events/
│   ├── layout.tsx                 Route metadata
│   ├── page.tsx                   /events: server auth, URL filters, audit query, history list and pagination
│   └── FilterForm.client.tsx      Record/user autocomplete; submits selected ID in the URL
├── vendors/
│   ├── layout.tsx                 Route metadata
│   ├── page.tsx                   /vendors: server auth, active vendor query, clickable list
│   ├── actions.ts                 Server Actions: save vendor and archive vendor
│   ├── VendorForm.client.tsx      Shared new/edit form; field state and action feedback
│   ├── new/
│   │   └── page.tsx               /vendors/new: auth check, then VendorForm
│   └── [id]/edit/
│       └── page.tsx               /vendors/:id/edit: validate ID, load vendor, then VendorForm
├── invoices/
│   ├── layout.tsx                 Route metadata
│   ├── page.tsx                   /invoices: server auth, active invoice query, clickable list
│   ├── actions.ts                 Server Actions: create, update, and archive invoices
│   ├── InvoiceForm.client.tsx     Shared new/edit fields; optional PDF preview and extraction
│   ├── payment-actions.ts        Authenticated Browser Use start, completion, and recovery
│   ├── DemoPayment.client.tsx     Progress polling and demo payment controls on approved invoices
│   ├── invoice-form.module.scss   Layout and form styles shared by new and edit pages
│   ├── new/
│   │   ├── page.tsx               /invoices/new: load vendor/property choices, then form
│   │   └── NewInvoiceSession.client.tsx  Remount the draft after leaving the cached new-invoice page
│   └── [id]/edit/
│       └── page.tsx               /invoices/:id/edit: load invoice and choices, then form
└── users/
    ├── layout.tsx                 Route metadata
    ├── page.tsx                   /users: admin check, profile query, clickable list
    ├── actions.ts                 Server Action: update profile name and role
    ├── UserForm.client.tsx        Edit form for profile name and role
    ├── new/
    │   ├── layout.tsx             Add-user page metadata
    │   ├── page.tsx               /users/new: admin check, then CreateUserForm
    │   ├── actions.ts             Server Action: create Supabase Auth account
    │   └── CreateUserForm.client.tsx  Account fields, pending state, result messages
    └── [id]/edit/
        └── page.tsx               /users/:id/edit: admin check, load profile, then UserForm
```

Shared pieces live outside the routes:

- [`browser-use.ts`](../../frontend/lib/invoices/browser-use.ts) calls the hosted agent from the server. [`payment.ts`](../../frontend/lib/invoices/payment.ts) defines its prompt and result validation. Payment attempt reads happen in the edit page; starts go through authenticated Server Actions and database reservation functions. [`workflows/invoice-payment.ts`](../../frontend/workflows/invoice-payment.ts) reconciles completion using short steps and durable waits, with a server-only Supabase client and service-role-only settlement RPC. Processing invoices stay locked; visible lists refresh while they are processing. See [demo payment setup and flow](../PLANS/browser-use-payments.md).

- [`ClickableTableRow.client.tsx`](../../frontend/components/ClickableTableRow.client.tsx) makes list rows open their edit page. The visible name or invoice reference remains a real link for keyboard access and opening a new tab.
- [`ArchiveButton.client.tsx`](../../frontend/components/ArchiveButton.client.tsx) supplies the confirmation and pending state for vendor, invoice, and property archiving. User profiles do not currently have an archive action.
- [`nav.tsx`](../../frontend/components/layout/nav.tsx) links the sidebar to resource lists and Activity, and supplies breadcrumb names for their routes. Rules, Activity, and Users sit under Admin; `SidebarNavigation.tsx` reads the current role on the server and passes an admin flag to the client navigation.
- [`roles.ts`](../../frontend/lib/users/roles.ts) defines the Clerk, Approver, and Admin choices shared by the new/edit user forms. `lib/users/access.ts` supplies request-scoped role lookup and admin page guards.
- [`status.ts`](../../frontend/lib/invoices/status.ts) defines the selectable invoice statuses and display labels.
- [`extract-invoice.ts`](../../frontend/lib/invoices/extract-invoice.ts) and [`invoice-parser.ts`](../../frontend/lib/invoices/invoice-parser.ts) turn PDF text into suggested form values.

## Request and save flow

```mermaid
flowchart LR
    List["List page<br/>server auth + query"] --> Row["Clickable row or Add button"]
    Row --> Page["Edit or new page<br/>server auth + optional record query"]
    Page --> Form["Client form<br/>fields + pending/errors"]
    Form --> Action["Server Action<br/>auth + validation + write"]
    Action --> DB["Supabase<br/>Auth or Postgres/RLS"]
    DB -. "Invoice/vendor/property write" .-> Audit["Row trigger<br/>writes audit_events"]
    Action --> Result["Navigate to list<br/>or return form result"]
    Form -. "Existing record" .-> History["History link<br/>/events?type=...&id=..."]
    History --> Viewer["Activity page<br/>server filter + paginated audit query"]
    Form -. "Optional PDF" .-> Extract["Invoice extraction route"]
    Extract --> Parser["PDF text parser"]
    Parser -. "Suggested fields" .-> Form
```

The `page.tsx` files keep the headings and layout on the server. They place request-time auth and data reads in an async child inside `<Suspense>`. Edit pages await the `[id]` route parameter, validate it, load one record, and return 404 when no record is available. Client form files contain only the interaction that needs React hooks. Server Actions repeat the auth check because a form action can be called without visiting its page.

Vendors write to `public.vendors`. The same `VendorForm.client.tsx` receives either an existing vendor or no vendor; `saveVendor` chooses update or insert. Archiving sets `deleted_at` and `deleted_by`, and the list excludes archived rows.

Invoices write to `public.invoices`. The list joins vendor and property names for display and excludes archived invoices. Its server-rendered Active / Paid / All links use `/invoices`, `/invoices?view=paid`, and `/invoices?view=all`. Active is the default; Paid selects paid rows, and All includes every nonarchived status. Invalid view parameters fall back to Active. The query applies the status filter in Supabase. Links into the shared invoice page preserve this view for its Back/Cancel controls; paid records display a View invoice heading. `/invoices/new` loads active vendor and property choices on the server. The edit page loads the invoice plus its choices, retaining an archived vendor or property if that invoice already references it. Both render `InvoiceForm.client.tsx`. New invoices go through the `createInvoice` Server Action and the `create_invoice_with_document` database function, which wraps `create_invoice_with_rules` and links an optional stored document in the same transaction. A passing invoice starts as `approved`; otherwise it starts as `waiting on approval`. The page then opens the saved invoice so the decision and reasons are visible. Status is read-only in the form; any signed-in user can manually approve a waiting invoice. After a successful field edit, the client returns to its originating list view; archiving redirects there from the Server Action. Invoice writes revalidate the list, dashboard, and Activity. Archive, History and Reopen are direct buttons in the form's action row; History is shown only to admins. Approved invoices also offer Reopen for correction; the reason is recorded on the status audit event and the invoice returns to waiting on approval. Saving corrections does not rerun automatic approval. Paid invoices offer only History. Form action rows with more than one button use small buttons (`btn-sm`, or `size="sm"` on `CButton` and `ArchiveButton`).

New and edit invoices share `InvoiceDocumentPreview.tsx` for PDFs and images. Before creating an invoice, the client uploads any selected file through `/api/invoices/document`. The server validates its signature and size, generates a unique path in the private `invoice-pdfs` bucket, and returns that path. The create action links it through the transactional database function; on a rejected save it attempts to remove the unused upload. Selecting a PDF posts to [`/api/invoices/extract`](../../frontend/app/api/invoices/extract/route.ts), which checks auth, validates the file, and calls the parser in `lib/invoices/`. When all required extracted values are present and vendor/property names each match one active ID, the client immediately calls `createInvoice`; otherwise it leaves the extracted values in the form for correction. Manual entry uses the same save action. The edit page generates a temporary signed URL on the server for the shared preview; Refresh document renews it. Existing invoices without an attachment show an empty preview. Approved invoices expose a separate `PaymentConfirmation.client.tsx` form backed by `save_invoice_payment_confirmation`; saving a nonblank confirmation records the number and changes status to `paid` atomically, then redirects to the active invoice list. The audit trigger records both changes. Paid invoices are excluded from the Active list and dashboard queries; the Paid and All list views provide read-only access to their saved document and confirmation. They also remain readable at their detail URL and in Activity. Their fields and confirmation are read-only, and payment/archive actions are hidden. A database trigger also prevents changes to paid rows. Paid invoices remain available as comparable history for approval rules.

Both invoice creation paths call `saveNewInvoice`, which clears fields, the selected file/preview, and extraction messages after a successful save. Save errors preserve the entered values while the page is active. Server-side route invalidation alone does not reset client form state.

Invoice identity is vendor + property + case-insensitive, trimmed reference number. A partial unique database index enforces this for nonarchived invoices in every status, including paid. Archiving sets `deleted_at` and releases that identity so an incorrect/test invoice can be replaced. Archived rows remain available in Activity. Restoring one while an active replacement exists fails the same unique check. Paid invoices remain read-only and cannot be archived through the application.

`/invoices/new` also wraps the form in `NewInvoiceSession.client.tsx`. Cache Components hides old pages in React Activity; a layout-effect cleanup advances this session's key so the entire draft remounts on return, including after a rejected duplicate or an abandoned upload. Errors and values remain while the user stays on the page, and an ordinary active-page data refresh (such as adding a vendor in a dialog) preserves the draft. Late extraction/save responses from a hidden visit cannot refill the new session or navigate the user away. New-invoice inputs disable browser autocomplete to avoid restoring old transaction values on a reload. Edit forms do not use this reset boundary. The React Activity regression test lives in `lib/invoices/new-invoice-session.test.ts`.

Users have two data sources. `/users/new` signs up an account through Supabase Auth; the database trigger creates its `public.profiles` row with the `clerk` role. The signed-in admin then assigns the selected role through the admin-only profile update policy; signup metadata never grants roles. If account creation succeeds but role assignment fails, the form reports that partial result and links to the editor. `/users/[id]/edit` updates the profile name and role, while the account email and password remain in Supabase Auth. The page and action check for an admin, and the profile update policy in the role migration enforces that check in Postgres as well. The new-user action returns a success or error message on the form; successful vendor and user edits return to their lists. The user edit form's History button opens Activity filtered to actions **performed by** that user. The list displays roles, and both create and edit expose the shared role selector. Role updates revalidate the root layout to refresh navigation; an admin demoting themselves returns to the dashboard. The existing last-admin database guard prevents lockout. Profile changes are not audit targets.

## Activity viewer

`/events` is an admin page route, not an API endpoint or a business form. The page and search API check the current profile role, and audit-event reads are admin-only under RLS. Its `page.tsx` checks auth and reads `searchParams` in a `<Suspense>`-wrapped server component. With no filter, it shows recent events. A filter uses `?type=invoice|vendor|property|actor&id=<uuid>`; `actor` matches `actor_user_id`, while the other types match the event's target record. `FilterForm.client.tsx` searches `/api/events/search` after two characters and submits the selected ID in a GET request. Invoice search matches vendor names and displays vendor, invoice reference, and property together; other types match their record names. Results include archived records and are limited to 20 per search. The server queries `public.audit_events` newest first and shows 50 events at a time with URL-based pagination. It resolves names using ID-filtered queries for the visible events and selected filter, including each invoice's vendor and property. These lookups include archived records and also validate the selected filter, even on an empty event page; no full-table picker lists are loaded. It renders each event's actor, timestamp, action, changed fields, and reason when present.

The database trigger records invoice, vendor, and property changes in `audit_events`, with exactly one target per event. The existing audit indexes support target and actor filters. Vendor, invoice and property edit forms link to their own record history; the user edit form links to actions by that user. Properties currently uses a same-page edit form at `/properties?edit=<id>`, rather than a separate `[id]/edit` route. Vendor, invoice, and property write actions revalidate `/events` after a successful change. The viewer does not track changes to user profiles or combine a vendor/property's history with events on related invoices.

## Adding another list/new/edit feature

1. Put the list at `app/<resource>/page.tsx`, the add page at `new/page.tsx`, and the edit page at `[id]/edit/page.tsx`.
2. Keep Supabase reads and auth checks in server components. Wrap request-time reads in `<Suspense>`.
3. Put form interaction in a `*.client.tsx` leaf. Reuse it for new and edit when both operations have the same fields.
4. Put writes in a nearby `actions.ts`; validate input and authorization inside every action. Add the database policy needed to protect the same operation. Revalidate routes that display changed data before navigating away.
5. Add the list link and route names in `components/layout/nav.tsx`. If the resource is audited, link its edit form to `/events?type=<resource>&id=<uuid>` and revalidate `/events` after writes. Verify new routes in a production build.
