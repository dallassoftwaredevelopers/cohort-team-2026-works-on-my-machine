# Invoice intake, approval rules, and payment

**Status:** The settings migration is applied. The evaluator and its shared-role policy update are local and unapplied. Payment and AI extraction are future work.

## Goal

Run the three approval checks **immediately during new invoice intake**. Treat a complete, valid extraction as the invoice data; do not wait for a person to review it before evaluating. An eligible invoice can proceed toward a future AI API payment workflow. Existing invoices stay in their current states; there is no backfill or retroactive evaluation. Qualifying existing invoices can still be used as comparison history.

## Starting state before this implementation

- The local `/rules` page and applied `approval_rule_settings` migration hold a global amount limit, percentage above average, and minimum comparable bill count. Settings start unset. The pending evaluator migration replaces the admin-only settings policy with access for every signed-in user.
- The authenticated `/api/invoices/extract` route currently uses `pdf-parse` plus a local parser to suggest form values. It does not persist the uploaded file or create an invoice. This extraction step may later call an AI API with the same structured output shape.
- `vendor.autopay` exists, but no workflow reads it. The invoice form currently lets any signed-in user choose `created`, `waiting on approval`, `approved`, or `paid`; the database also permits direct status writes. Status permissions must be tightened before automatic decisions are enabled.
- The Pay link currently opens a URL. It does not execute or verify a payment. The invoice audit trigger records status changes but does not explain rule results.

## Proposed intake flow

1. A user uploads a PDF or enters an invoice manually. The upload path extracts vendor, property, invoice number, amount, and dates, then resolves vendor/property names to unique IDs. The current parser can later be replaced by an AI API. There is no mandatory review or confirmation screen for a complete extraction.
2. Once extraction and ID matching produce the required valid fields, **create and evaluate the invoice right away** in one intake operation. The manual-entry path runs the same checks on its initial save. Validate required fields and duplicate identity, then read vendor autopay, the three rule settings, and comparable history. There is no separate Submit for approval button and no later job to evaluate old invoices.
3. If autopay is on, all settings exist, and all three checks pass, save the new invoice as `approved` and record why. Otherwise save it as `waiting on approval` with all failed or unavailable reasons. If extraction is incomplete, a name cannot be matched uniquely, or a required value is invalid, stop automatic intake and show the fields for correction; do not invent missing IDs or approve an unvalidated invoice. A database error must be shown to the user rather than silently producing an approval.
4. Any signed-in user may manually approve an invoice waiting for review. `created` remains available for manual drafts or existing test records; current test invoices are not changed by rollout.
5. A later payment worker may act on an approved invoice when vendor autopay is on. The planned AI API can assist with a vendor's payment flow, but `paid` is recorded only after the payment result is verified. A failed or uncertain attempt leaves the invoice approved and records the attempt for review or retry.

For automatic intake, assume the extractor's returned values are factually correct. Validate their format, required fields, and unique vendor/property matches, but do not add a confidence threshold or human accuracy review before the rules run.

### Rule definitions

| Check | Pass condition | Waiting on approval when… |
|---|---|---|
| Amount limit | `invoice.amount <= max_auto_approval_amount` | The limit is unset or the amount is greater |
| Short history | Comparable bill count `>= min_comparable_bills` | The minimum is unset or there are too few bills |
| Unusual amount | `invoice.amount <= average * (1 + max_above_average_percent / 100)` | The percentage is unset or no usable average exists |

**Comparable bill, proposed:** Same vendor **and** property, nonarchived, status `approved` or `paid`, and an invoice date earlier than the new bill. This includes existing invoices and fake past invoices entered for the demo; no evaluation record is required. An invoice approved manually after failing the rules can contribute to later history. Calculate the arithmetic average with database `numeric` values; equality passes a threshold. New invoices with too little history wait for a person, allowing the first few approved bills to establish a baseline. Test data that would distort the average can be removed before rollout.

**Demo history setup:** Enter fictional invoices with the same vendor and property and earlier invoice dates, then have a signed-in user approve them. They will count toward both the minimum history and average checks. An existing `approved` or `paid` invoice that meets those criteria counts too; no special backfill is needed. The current new-invoice form stamps today's date, so genuinely earlier invoice dates must be seeded or corrected through a controlled database fixture for the demo.

## Implementation shape

- Keep `/rules` as the editor for one global set of thresholds. Do not add per-vendor or per-property overrides yet.
- Keep extraction behind the authenticated `/api/invoices/extract` route: the current parser and future AI API must return the same structured fields. On file selection, the client matches extracted names to unique vendor/property IDs and immediately calls `createInvoice`; the Server Action validates those IDs and writes through the transactional database function. The manual form calls the same action. A human correction path is needed only when extraction or matching cannot create a valid invoice.
- Put invoice creation and rule evaluation in one transactional database operation shared by upload intake and the manual-entry Server Action. The function should check the authenticated actor, enforce the duplicate rule, read settings/history, insert the invoice with its decision, and record the evaluation. A single transaction prevents a saved invoice from receiving an unrecorded decision. Keep money comparisons in database `numeric` arithmetic.
- Add an immutable evaluation record indexed by invoice ID with outcome, reason codes, settings snapshot, comparable count, and average. This explains new decisions; it is not a requirement for a past invoice to count as comparable history. The invoice edit page can show the latest decision. The existing audit trigger records a new invoice's initial status in its `created` event and records later status updates separately.
- Replace the free status selector with a read-only status and specific actions. Tighten database grants/policies so a direct Supabase request cannot set `approved` or `paid` by bypassing the UI. Server Actions also check authentication. The demo uses one shared role, with a separate identity for each signed-in person. Revalidate invoice list, edit page, dashboard, and Activity after status changes.
- Add a separate, durable payment-attempt record and worker when payment integration is ready. Keep one active payment intent per invoice, record retries as separate attempts, and use an idempotency key, restricted provider credentials, and a verified external result before changing status to `paid`. Never treat an AI response alone as proof of payment. The exact AI API, payment provider, and deployment mechanism remain to be chosen.

### Shared-role workflow

All signed-in users have the same application permissions: enter invoices, edit rule settings, and manually approve waiting invoices. Accounts default to `admin` in the existing user workflow, but rules access requires authentication rather than a particular profile role. Audit events still identify the individual actor.

Status changes continue through the database functions. The approval action accepts only active invoices in `waiting on approval`; arbitrary status writes remain blocked. The manual workflow now records a confirmation number and sets `paid` in one operation. Paid invoices leave active lists and become read-only. A future payment worker can use the same confirmation operation after verifying the external result.

More actions contains History, Archive, and (for approved invoices) Reopen for correction. Reopening requires a reason, atomically records it with the status change, and returns the invoice to waiting on approval. Users save corrections and explicitly approve again; automatic rules do not rerun on edits. Paid invoices cannot be reopened. The form has no unrestricted status dropdown.

## Target files

- `frontend/supabase/migrations/`: add evaluation records, transactional intake, authenticated status transitions, and later payment-attempt records after the rules settings migration.
- `frontend/app/invoices/actions.ts`: call shared transactional intake for manual entry and authenticated manual actions.
- `frontend/app/invoices/InvoiceForm.client.tsx` and `[id]/edit/page.tsx`: trigger automatic intake on upload, show correction fields only when needed, and display decision explanations and manual approval actions.
- `frontend/app/api/invoices/extract/route.ts` and `frontend/lib/invoices/`: preserve the extraction response contract when replacing the parser with an AI API. `InvoiceForm.client.tsx` starts extraction and intake automatically when a PDF is selected.
- `frontend/lib/invoices/status.ts`: keep status labels and allowed transitions together.
- `frontend/app/events/page.tsx`: show automatic and manual decisions clearly if audit reasons are added.
- `frontend/app/rules/`: already supplies settings; adjust wording or validation only if rule definitions change.

## Phases

- [x] Apply the rules settings migration.
- [ ] Apply the pending evaluator migration, including its shared-role settings policy update.
- [ ] Add transactional new-invoice evaluation, evaluation records, and database status-transition restrictions. Do not alter existing invoice rows.
- [ ] Make a valid upload create and evaluate its invoice immediately, and make manual-entry save use the same checks. Show rule reasons and a correction path for incomplete extraction. Remove direct status selection from the forms.
- [ ] Add authorized manual approval and an explicit correction/reopen path.
- [ ] Test automatic pass, every rule failure, autopay off, unset settings, boundary equality, duplicate intake, inclusion of qualifying existing invoices, and unauthorized status writes with fictional invoices.
- [ ] Separately design and implement the AI extraction replacement and AI-assisted payment integration, including durable attempts, retry handling, and verified payment results.

## Decisions needed before implementation

| Question | Recommendation |
|---|---|
| Is review required before evaluation? | No. A complete, valid extraction flows directly into invoice creation and rule evaluation. Invalid or unmatched fields require correction before an invoice can be created. |
| What counts as a comparable bill? | Same vendor/property, nonarchived, approved or paid, and earlier invoice date, including existing records and fake past invoices. Confirm same-day and manually approved bills. |
| What happens if history is short, settings are missing, or autopay is off? | Set `waiting on approval` with the reason; never auto approve from incomplete evidence. |
| Who may change status? | Any signed-in user may manually approve a waiting invoice. Saving a confirmation on an approved invoice sets `paid`; paid invoices are retained read-only. A future payment worker will supply its verified confirmation through the same operation. |
| When should AI-assisted payment start? | After approval and only for autopay vendors. Confirm provider, authorization, and whether manual approval may also start it. |

## Out of scope for the first rules increment

- Migrating, reclassifying, or reevaluating existing test invoices. They may count as history when they meet the same criteria as any other bill.
- Executing payments or replacing the extractor in the same PR as the first rule evaluator. They are planned follow-on integrations.
- More rule types, per-resource overrides, recurring schedules, or retroactive reevaluation.
