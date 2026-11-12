# CYC Cohort 2026 — Works on My Machine

**Team 5 | Fall 2026 CYC Cohort**

An invoice-processing application that helps property management and accounts-payable teams extract, review, approve, and process vendor invoices.

## 1. Project Overview

### The Problem

Processing invoices manually can be time-consuming and error-prone. Accounts-payable employees must read invoices, enter financial information, verify accuracy, obtain approvals, and submit payments.

Our project explores how software can simplify this workflow while keeping financial information accurate and maintaining appropriate human oversight.

### Our Solution

Build a full-stack web application that allows users to upload a PDF invoice, extract its information, review and correct the results, approve or reject the invoice, save it, and submit payment through a fictional vendor website.

### MVP Goal

**Deliver one complete, deployed invoice-processing workflow, including payment through a mock vendor website.**

Success means demonstrating the complete workflow with fictional invoices, persistent data, and verifiable results.

## 2. Minimum Viable Product (MVP)

### End-to-End Workflow

1. **Upload PDF:** A user uploads a fictional vendor invoice.
2. **Extract:** The application extracts four required fields:
   - Vendor
   - Invoice number
   - Amount due
   - Due date
3. **Review and Correct:** The user verifies the extracted information and corrects any errors.
4. **Approve or Reject:** The invoice follows the appropriate approval path.
5. **Save and Reload:** Invoice details and decisions persist and can be retrieved.
6. **Submit Mock Payment:** An eligible invoice is submitted through the fictional vendor payment website.
7. **Record Result:** The application records and displays the mock payment result.

### Important Business Rules

- Missing or uncertain extraction results must not be invented.
- Invoice corrections must persist after saving.
- Rejected invoices must not be submitted for payment.
- Approval does not automatically mean payment was successful.
- Failed payment attempts must be recorded accurately.
- Duplicate payment submissions must be prevented.
- All transactions use fictional data. No real money is transferred.

### Approval Paths

The proposed workflow includes two approval paths:

**Manual Approval:** An authorized user reviews and approves or rejects an invoice before payment.

**Configured Automatic Approval:** For eligible invoice types or vendors, submitting the invoice may constitute the user's authorization to proceed through a predefined approval workflow.

The precise automatic-approval conditions and permissions require confirmation before implementation.

### Outside the Initial MVP

Unless separately approved:

- Real-money transactions
- Production payment-provider integrations
- Email-based invoice intake
- Broad property-management portal functionality
- Fully autonomous financial operations
- Advanced reporting and analytics

Mock vendor-site payment is explicitly **inside** the MVP scope.

## 3. Technology Stack

Technology choices must follow approved team decisions in [DC-40](https://one-atlas-duuf.atlassian.net/browse/DC-40).

| Component | Current documentation |
|---|---|
| Frontend | Next.js / React / TypeScript |
| UI framework | CoreUI for React |
| Styling | Sass / SCSS |
| Backend | Confirm approved implementation |
| Database | Confirm approved implementation |
| PDF extraction | Confirm implementation approach |
| Deployment | Vercel frontend deployment exists; verify remaining services |
| Testing | Confirm available project scripts and tools |

Do not treat proposed backend, database, or hosting choices as approved without checking the team decision record.

## 4. Getting Started

### Prerequisites

- Git
- Node.js and npm versions compatible with the frontend project
- Repository access
- Access to the required development environment configuration

Check the project's package files for supported runtime versions.

### Clone the Repository

```bash
git clone https://github.com/dallassoftwaredevelopers/cohort-team-2026-works-on-my-machine.git
cd cohort-team-2026-works-on-my-machine
```

### Frontend Setup

The frontend application is located in `frontend/`.

```bash
cd frontend
npm install
```

Review `frontend/package.json` to confirm the available development commands.

For a standard Next.js development script:

```bash
npm run dev
```

Open the local URL printed by the development server.

**Note:** The commands above describe the intended setup. They have not been independently validated against the latest repository configuration.

### Backend Setup

Backend setup instructions must be added or verified against the team's actual implementation.

Document:

- Required language/runtime version
- Dependency installation
- Local server startup command
- API base URL
- Database connectivity
- PDF extraction dependencies
- Test commands

Avoid documenting speculative commands as though they are operational.

### Environment Variables

Never commit credentials, tokens, passwords, or production secrets.

Environment configuration should follow these conventions:

- Use `.env.example` files containing placeholder values only.
- Keep real `.env` files out of version control.
- Document the purpose of every required variable.
- Confirm that `.gitignore` excludes local secret files.
- Share credentials through an approved secure method.

**Pending verification:** The required environment variables and `.env.example` files must be checked against the actual frontend and backend implementation.

### Troubleshooting

If local setup fails:

1. Check the README and installed runtime versions.
2. Verify dependencies are installed.
3. Confirm required environment variables are configured.
4. Review the terminal error message.
5. Search existing Jira issues and GitHub PRs for the same problem.
6. Share reproducible details with the team.

For the known CoreUI/Turbopack Sass issue, see [DC-85](https://one-atlas-duuf.atlassian.net/browse/DC-85).

## 5. Project Structure

The repository includes a `frontend/` application.

Document the remaining folder structure against the actual repository before treating it as authoritative.

A representative frontend structure is:

```text
frontend/
├── app/
│   └── invoices/
│       └── upload/
│           ├── page.tsx
│           ├── upload.client.tsx
│           └── upload.module.scss
├── styles/
│   ├── _variables.scss
│   └── main.scss
└── package.json
```

This illustrates the documented CoreUI conventions, not a fresh verification of every file path.

Backend, database, and extraction directories should be documented once verified.

## 6. Frontend UI — CoreUI

The frontend uses [CoreUI for React](https://coreui.io/react/docs/getting-started/introduction/) with Sass customization.

Tailwind is not used in the documented frontend styling approach.

### Component Conventions

- Keep `page.tsx` as a Server Component when possible.
- Place interactive UI in sibling `*.client.tsx` components.
- Use `"use client"` for components requiring browser interaction or React client hooks.
- Use CoreUI layout components for page structure.
- Prefer CoreUI components and utility classes before introducing custom styling.
- Keep custom component styles in adjacent `.module.scss` files.
- Avoid global element selectors that unintentionally override CoreUI.

### Server and Client Components

Layout components such as `CContainer`, `CRow`, `CCol`, `CCard`, `CCardHeader`, and `CCardBody` are documented for server-side layout use.

Interactive components such as `CButton`, `CFormInput`, `CAlert`, `CModal`, and `CDropdown` belong in client components when they require client-side React behavior.

For navigation links, use Next.js `Link` with the appropriate CoreUI classes.

### Sass Conventions

The documented styling files are:

```text
frontend/styles/_variables.scss
frontend/styles/main.scss
```

Use `_variables.scss` for CoreUI variable customization.

Use `main.scss` for global CoreUI styling and intentionally shared global styles.

Consult the installed CoreUI version before changing Sass imports or variable-forwarding patterns, particularly while DC-85 is being resolved.

### CoreUI References

- [Getting Started](https://coreui.io/react/docs/getting-started/introduction/)
- [Sass Customization](https://coreui.io/react/docs/customize/sass/)
- [CSS Variables](https://coreui.io/react/docs/customize/css-variables/)
- [Grid](https://coreui.io/react/docs/layout/grid/)
- [Forms](https://coreui.io/react/docs/forms/overview/)
- [Buttons](https://coreui.io/react/docs/components/button/)

## 7. Team and Collaboration

### Current Team Members

- Tim Lines
- Cheryl Carpenter
- Amy Denzer
- Promise Morka
- Josh Bloom
- Mandela Tumukunde
- Eric Aguayo

There are seven current team members.

Work ownership is tracked in Jira. Contributions and technical responsibilities are collaborative rather than permanently assigned by this README.

### Jira Workflow

[Jira Board — Project DC](https://one-atlas-duuf.atlassian.net/jira/software/projects/DC/boards/178)

Use the following status meanings:

| Status | Meaning |
|---|---|
| Backlog | Work needs clarification, prioritization, or prerequisites |
| Ready | Scope and acceptance criteria are clear; work can begin |
| In Progress | Someone is actively implementing or completing the work |
| Blocked | Progress cannot continue until a dependency is resolved |
| Code Review | Work is awaiting or undergoing review |
| Done | The agreed Definition of Done has been satisfied |

**Critical priority** identifies work required for the MVP. Priority does not imply that a ticket is Ready.

Before starting:

1. Check existing Jira issues.
2. Confirm the task is Ready.
3. Review acceptance criteria and dependencies.
4. Coordinate ownership with the team.
5. Update status as work progresses.
6. Link the relevant PR and testing evidence.

Avoid duplicate tickets when existing issues can be updated.

## 8. Git and Pull Request Conventions

### Branches

Use feature branches rather than committing directly to `main`.

Suggested naming:

```text
feature/DC-56-upload-screen
fix/DC-85-coreui-sass
docs/DC-52-readme
test/DC-64-extraction-tests
```

These names are recommended conventions, subject to team agreement.

### Commits

Write focused commits with descriptive messages.

Examples:

```text
docs: update MVP workflow in README
fix: resolve invoice review validation issue
test: add extraction edge-case coverage
```

### Pull Requests

Before requesting a merge:

- Reference the relevant Jira issue.
- Explain what changed and why.
- Document how the change was tested.
- Include screenshots or examples for UI changes where useful.
- Identify known limitations.
- Resolve blocking review feedback.
- Obtain at least one formal teammate approval before merging.

A positive comment is not necessarily a formal GitHub approving review.

Do not push directly to `main` unless explicitly permitted by the team's repository rules.

**Repository protection settings:** The active [`main` ruleset](https://github.com/dallassoftwaredevelopers/cohort-team-2026-works-on-my-machine/rules/25132582) requires one approving review. It currently has no required status checks. The workflow reports validation on each PR. To make a passing result mandatory for merge, a repository or organization administrator with ruleset access must add the **Lint, types, tests, and build** check after its first run. Organization Actions policy must allow the checkout and setup-node actions.

## 9. Testing and Acceptance Criteria

### Pull request validation

The **PR validation** workflow runs when a pull request targeting `main` opens, reopens, or updates. GitHub shows the job and its step logs in the pull request's **Checks** tab.

Run the same commands locally with Node.js 24. Set the two variables from [`frontend/.env.example`](frontend/.env.example) in your shell or `frontend/.env.local`. The CI build uses placeholder values and requires no Supabase credentials. The build downloads Geist fonts, so it needs access to Google Fonts.

```bash
cd frontend
npm ci
npm run lint
npm exec -- next typegen
npm exec -- tsc --noEmit
npm test
npm run build
```

These checks cover the Next.js frontend and server-side TypeScript, including the invoice extraction tests. They do not provision Supabase or run database migrations.

### Happy-Path Test

Using a fictional sample invoice:

1. Upload the PDF.
2. Confirm the four required fields are extracted.
3. Correct at least one extracted value.
4. Save the invoice.
5. Reload it and verify the correction persisted.
6. Approve the invoice.
7. Submit the mock payment.
8. Verify the mock vendor website's result.
9. Reload the invoice and confirm the payment status is preserved.

### Rejection Test

1. Upload and review an invoice.
2. Reject the invoice.
3. Verify the rejection persists.
4. Confirm the invoice cannot proceed to mock payment.

### Error and Edge Cases

Test:

- Invalid or unsupported PDF
- Missing invoice fields
- Incorrect extracted values
- Invalid amount or date
- Save or retrieval failure
- Mock vendor website failure
- Duplicate payment submission
- Unavailable or unsuccessful payment response

### Extraction Benchmark

Use the team's fictional invoice benchmark and associated Jira tasks to evaluate extraction quality.

Do not invent missing values or substitute unrelated financial fields.

Relevant tasks:

- [DC-37 — Extraction Benchmark](https://one-atlas-duuf.atlassian.net/browse/DC-37)
- [DC-64 — Extraction Accuracy Tests](https://one-atlas-duuf.atlassian.net/browse/DC-64)

### Integration Verification

[DC-65 — Integrate and Test Complete MVP Workflow](https://one-atlas-duuf.atlassian.net/browse/DC-65) tracks the full deployed integration.

Passing individual component tests is not sufficient evidence that the entire workflow works.

## 10. Definition of Done

A development task is Done when applicable requirements have been satisfied:

- Acceptance criteria are met.
- The change works as intended.
- Relevant tests pass.
- Error conditions are handled.
- Code is readable and maintainable.
- A teammate has reviewed and formally approved the PR.
- Changes are merged according to repository rules.
- Documentation is updated where needed.
- Jira contains relevant verification evidence.
- No real credentials or sensitive payment information have been exposed.

Documentation-only tasks should have their own appropriate verification criteria.

A working prototype is not automatically Done.

## 11. MVP Roadmap

### Phase 1 — Foundation

- Confirm the technology stack.
- Establish frontend/backend integration.
- Define invoice data structures and API contracts.
- Establish local development conventions.

### Phase 2 — Invoice Processing

- PDF upload
- Four-field extraction
- Review and correction
- Approval/rejection
- Persistence and retrieval

### Phase 3 — Mock Payment

- Confirm fictional vendor-site integration interface.
- Submit eligible invoices.
- Record mock payment results.
- Handle failed and duplicate attempts.

### Phase 4 — Integration and Deployment

- Connect the complete workflow.
- Test the deployed application.
- Fix integration defects.
- Review and merge PRs.
- Demonstrate the complete MVP.

These phases describe logical dependencies, not fixed deadlines or confirmed sprint assignments.

### Future Possibilities

Subject to requirements and team decisions:

- Email invoice intake
- More advanced extraction methods
- Automated approval policies
- Real payment-provider integrations
- Broader property-management functionality
- Reporting and analytics

## 12. AI Usage Policy

The cohort prohibits AI-generated implementation code during the initial two-week restriction period beginning October 12, 2026.

During this period, use AI only for activities permitted by the cohort organizers, such as:

- Planning
- Documentation
- Architecture discussion
- Conceptual learning
- Test planning
- Debugging guidance

Do not use AI coding agents to bypass implementation restrictions.

After the initial restriction period, confirm current guidance with the cohort organizers before changing development practices.

Official guidance should take precedence over this README.

## 13. Project Resources

| Resource | Link |
|---|---|
| Jira Board | [Team 5 — DC](https://one-atlas-duuf.atlassian.net/jira/software/projects/DC/boards/178) |
| GitHub | [Works on My Machine](https://github.com/dallassoftwaredevelopers/cohort-team-2026-works-on-my-machine) |
| Miro | [Active Collaboration Board](https://miro.com/app/board/uXjVEZO0WzY=/?share_link_id=39161681318) |
| Team Decisions | [Discord Decisions](https://discord.com/channels/739845668582981683/1559970772657774592) |
| Official CYC Communications | [Discord Official Guidance](https://discord.com/channels/739845668582981683/1559969504581255198) |
| Meeting Notes | [Discord Notes](https://discord.com/channels/739845668582981683/1559392975920828547) |
| MVP Epic | [DC-49](https://one-atlas-duuf.atlassian.net/browse/DC-49) |
| User Stories | [DC-14](https://one-atlas-duuf.atlassian.net/browse/DC-14) |
| Integration Testing | [DC-65](https://one-atlas-duuf.atlassian.net/browse/DC-65) |

### Deployed Application

https://cohort-team-2026-works-on-my-machin.vercel.app/

This is the known frontend deployment URL. Its current functionality and integration health must be verified through testing.

## 14. Contributing

We welcome contributions from all seven team members.

1. Find a Ready Jira issue.
2. Confirm ownership and dependencies.
3. Create a focused feature branch.
4. Implement the change under current cohort policies.
5. Test the relevant behavior.
6. Open a pull request linked to Jira.
7. Request teammate review.
8. Address feedback.
9. Merge only after the required approval and checks.
10. Update Jira with results and evidence.

For blockers, communicate early so teammates can help.

## 15. License

To be determined by repository owners or cohort organizers.

---

**Team 5 — Works on My Machine**

*Coordinate clearly. Build small. Test thoroughly. Iterate continuously.*

**Commit your code.**
