# Plans

Implementation plans for upcoming work. Each plan lists its status, the files it targets, phases with checkboxes, and open decisions. **Resolve the "Decisions needed" section before implementing.**

| Plan | Status | Summary |
|---|---|---|
| [invoice-approval-rules.md](./invoice-approval-rules.md) | Draft | Evaluate new invoices at intake, protect status transitions, then add AI extraction and payment integrations |
| [ai-browser-payment-agent.md](./ai-browser-payment-agent.md) | Implemented for local review | Restricted mock-payment worker, explicit authorization, verification, and setup |
| [ai-payment-preview-validation.md](./ai-payment-preview-validation.md) | Local validation passed | Test results, Vercel safety requirements, proposed PR and physical-iPhone acceptance |

## Adding a plan

- One plan per file, in kebab-case: `feature-name.md`
- Include: status, target files, current state, phases with checkboxes, decisions needed, out of scope
- Follow [code-patterns/](../code-patterns/index.md)
- Add a row to the table above and update the status as work moves forward
