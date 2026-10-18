# Works on My Machine — Product Requirements Document

**Version:** 0.1 (draft)  
**Date:** October 17, 2026  
**Team:** CYC Cohort, Team 5  
**Status:** Proposed for team review; not approved

## 1. Product summary

Build a small accounts-payable application that reduces manual entry of PDF invoices while preserving human review and control. A user uploads a PDF invoice, the application extracts key information, and a human reviews and corrects the information before approving or rejecting it. The application saves the record and decision for later retrieval.

**Product goal:** Demonstrate a reliable, understandable invoice-to-decision workflow, not an autonomous payment system.

## 2. Problem and users

Manual invoice processing requires people to open documents, transcribe details, check amounts and dates, obtain approval, and track outcomes. This is repetitive and error-prone.

**Primary user (proposed):** Accounts-payable clerk or small-business operator reviewing invoices.  
**Secondary user (proposed):** Approver who accepts or rejects an invoice.  
**Context:** Property management is one possible demonstration domain, not a confirmed product requirement.

## 3. End-to-end workflow

1. User uploads one PDF invoice.
2. System extracts **vendor, invoice number, total amount, and due date**.
3. System presents the extracted values for human review; missing or uncertain values are clearly visible.
4. User edits incorrect values and chooses **Approve** or **Reject**.
5. System saves the invoice data and decision.
6. User can retrieve the saved record and see its decision state.

Approval records a decision **inside this application**; it does not pay the invoice.

## 4. Functional requirements

| ID | Requirement | MVP acceptance criterion |
|---|---|---|
| FR-01 | PDF intake | User can select and upload a single supported PDF; unsupported or unreadable files produce an understandable error. |
| FR-02 | Field extraction | System attempts to identify vendor, invoice number, total amount, and due date from the uploaded PDF. |
| FR-03 | Human review | All four fields are displayed and editable before a decision. Missing fields do not silently become fabricated values. |
| FR-04 | Decision | User can approve or reject an invoice after review; saved state reflects the chosen action. |
| FR-05 | Persistence | Invoice details, corrections, and decision can be saved and retrieved after refreshing or revisiting the application. |
| FR-06 | End-to-end demonstration | At least one agreed fictional test invoice completes the entire workflow on a shareable deployment. |

**Suggested states:** Pending Review, Approved, Rejected. State names and transitions require team confirmation.

## 5. Scope and roadmap

### MVP — required for the first working vertical slice
- One PDF upload at a time.
- Extraction of four essential fields.
- Editable review screen.
- Human approve/reject decision.
- Save and retrieve invoice information and decision.
- Deployed demonstration and basic end-to-end test.

### Later increments — candidates, not commitments
- Multiple invoices, search/filtering, and richer invoice history.
- More fields, line items, vendor matching, duplicate detection, and stronger validation.
- Image-based PDF handling with OCR fallback.
- Role-based permissions, audit history, notifications, and improved accessibility.
- Email intake and workflow integrations.

### Explicitly outside the initial MVP
- Real money movement, payment submission, or interaction with vendor payment websites.
- Autonomous approval or autonomous AI agents.
- A full property-management portal.
- Production accounting integrations or unattended processing.

## 6. Quality and nonfunctional requirements

- **Correctness:** Never silently present invented extraction values as confirmed facts; allow manual correction.
- **Usability:** A reviewer can understand the invoice fields, decision, and errors without technical knowledge.
- **Resilience:** Handle invalid uploads, extraction failure, missing values, and save failures gracefully.
- **Data handling:** Use fictional invoices for demos; avoid real financial or personal data until privacy and security requirements are defined.
- **Maintainability:** Keep responsibilities and interfaces understandable; document setup and decisions.
- **Testing:** Exercise a successful invoice path and meaningful failure cases; expand to the team's existing fictional invoice set as time permits.
- **Completion:** Apply the team's approved Definition of Done, including appropriate testing, review, and documentation. A working prototype alone is not automatically Done.

## 7. Technical direction (proposed; not approved)

Candidate architecture: **Next.js / React / TypeScript** frontend; **Python / FastAPI** extraction/backend; **PostgreSQL** persistence; deployment platforms to be decided. Prefer the simplest stack the team can build, test, and deploy reliably. A single full-stack application remains an alternative. Text extraction should be validated before choosing an OCR approach.

**Decision reference:** [DC-40 — Technical stack](https://one-atlas-duuf.atlassian.net/browse/DC-40).

## 8. Validation and success criteria

The first MVP demonstration succeeds when a teammate can:

1. Open the deployed application.
2. Upload a fictional PDF invoice.
3. Inspect and correct four extracted fields.
4. Approve or reject the invoice.
5. Reopen the saved record and see the corrected values and decision.

Record observed results, defects, and limitations. One passing example proves the vertical slice, **not** extraction reliability across all invoice formats.

## 9. Risks and unresolved decisions

| Question / risk | Next action |
|---|---|
| Are the MVP workflow and user roles approved? | Team review of this PRD and [DC-9](https://one-atlas-duuf.atlassian.net/browse/DC-9). |
| Which stack and hosting approach will the team use? | Compare options and record agreement in [DC-40](https://one-atlas-duuf.atlassian.net/browse/DC-40). |
| How well do libraries extract the sample PDFs? | Complete [DC-44](https://one-atlas-duuf.atlassian.net/browse/DC-44) technical spike and document findings. |
| What are the exact invoice fields and states? | Align [DC-15](https://one-atlas-duuf.atlassian.net/browse/DC-15) data model and [DC-18](https://one-atlas-duuf.atlassian.net/browse/DC-18) API. |
| What evidence is required for Done? | Confirm the cohort/team Definition of Done and test plan. |
| Does the AI restriction allow AI-authored repository documentation? | Confirm with cohort leadership before committing or publishing this draft. |

## 10. Collaboration and traceability

- **Jira:** [DC project board](https://one-atlas-duuf.atlassian.net/jira/software/projects/DC/boards/178) — work items, ownership, status, and acceptance criteria.
- **GitHub:** [Team repository](https://github.com/dallassoftwaredevelopers/cohort-team-2026-works-on-my-machine) — versioned code and documentation, once permitted.
- **Miro:** [Active team board](https://miro.com/app/board/uXjVEZO0WzY=/?share_link_id=39161681318) — research, architecture, and wireframes.
- **Discord:** [Team Decisions](https://discord.com/channels/739845668582981683/1559970772657774592) — confirmed decisions; [official communications](https://discord.com/channels/739845668582981683/1559969504581255198) — policy and requirements.

**Change process:** Propose PRD edits through team review; record agreed product decisions in Discord and update relevant Jira issues. Silence is not approval. This draft does not supersede official cohort requirements.
