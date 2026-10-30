# Works on My Machine — MVP Data Access Contract

**Version:** 1.1 (Draft)  
**Date:** October 24, 2026  
**Team:** CYC Cohort, Team 5  
**Jira:** DC-18  
**Status:** Proposed for team review

## 1. Overview

This document defines the proposed data access operations and expected data formats for the manual invoice entry workflow.

The implementation will build on the existing Next.js, CoreUI, and Supabase infrastructure, reusing available components and database access patterns wherever possible.

**Manual entry workflow:**

Select Vendor → Select Property → Enter Reference Number → Enter Invoice Date → Enter Amount → Enter Due Date → Submit → Save Invoice → Retrieve Invoice

Invoice creation is separate from approval, rejection, and mock vendor payment. These additional workflows remain part of the overall MVP but are outside the scope of this contract.

This contract describes required behavior rather than mandating custom REST API endpoints or specific function implementations.

## 2. Data Access Operations

The manual invoice workflow requires the following database operations. The existing application uses the Supabase JavaScript client to interact with the database directly, so custom Next.js API routes are not necessarily required for basic data retrieval and invoice creation.

| Operation               | Database Table | Purpose                                               | Jira  |
| ----------------------- | -------------- | ----------------------------------------------------- | ----- |
| `getAllVendors()`       | `vendors`      | Retrieve vendors for selection on the invoice form    | DC-90 |
| `getAllProperties()`    | `properties`   | Retrieve properties for selection on the invoice form | DC-91 |
| `createInvoice()`       | `invoices`     | Validate and save a new invoice                       | DC-92 |
| `getInvoice(invoiceId)` | `invoices`     | Retrieve a previously saved invoice by ID             | DC-89 |
| `getPropertyId()`       | `properties`   | Obtain the selected property's ID                     | DC-88 |

These names describe logical operations, not necessarily separate functions that must be implemented.

### Existing Implementation

The Properties page (`frontend/app/properties/page.tsx`) already retrieves records using the Supabase JavaScript client.

This demonstrates an existing database access pattern that may be reused for the manual invoice form.

The remaining operations have not yet been verified as implemented for the invoice workflow.

### Implementation Considerations

- Review existing functionality before implementing additional database operations.
- Reuse existing Supabase client queries where appropriate.
- Preserve the required input fields, output data, and validation rules.
- Handle database errors and provide useful feedback.
- Enforce access permissions through appropriate Supabase Row Level Security (RLS) policies.
- Use server-side operations when privileged credentials or sensitive business logic require them.
- Reuse the selected property's ID from `getAllProperties()` where available, rather than introducing an unnecessary database lookup.

The implementation approach remains subject to team review.

## 3. Data Access Conventions

- **Format:** JSON-compatible data.
- **Authentication:** Existing application authentication using Supabase Auth.
- **Identifiers:** UUIDs for invoice, vendor, and property records.
- **Dates:** `YYYY-MM-DD`.
- **Success results:** Return requested records or saved record information.
- **Money:** USD for the proposed MVP; confirm currency scope with the team.
- **Error handling:** Handle Supabase errors consistently and provide meaningful feedback.
- **Security:** Authenticate users and enforce authorization through appropriate Supabase RLS policies.

Supabase JavaScript client operations typically return `data` and `error` values.

HTTP status codes remain relevant when using HTTP endpoints, but they are not the required application-level response contract for direct Supabase client operations.

## 4. Data Input and Output Formats

The following examples define expected data fields and logical operation results. They do not require separate REST endpoints.

### Get Vendors — DC-90

**Operation:** `getAllVendors()`

**Expected data:**

```json
[
  {
    "id": "e7b20ed1-cbe0-49b1-95eb-d604e56d7fd0",
    "name": "ABC Plumbing"
  }
]
```

Returns available vendors to populate the Vendor selection field.

Each vendor must provide an ID and a display name.

The operation should handle empty results and database errors appropriately.

### Get Properties — DC-91

**Operation:** `getAllProperties()`

**Expected data:**

```json
[
  {
    "id": "c262217a-6b64-4f4a-ade4-23e26d94ec06",
    "name": "Example Property"
  }
]
```

Returns available properties to populate the Property selection field.

Each property must provide an ID and a display name.

The selected property's ID should be retained for invoice creation.

### Get Property ID — DC-88

**Operation:** `getPropertyId()`

The invoice form requires the unique ID of the selected property.

When `getAllProperties()` returns both the property ID and name, the application can retain the ID associated with the user's selection.

A separate database lookup is not required if the ID is already available.

Confirm with Josh whether a distinct `getPropertyId()` function is necessary.

### Create Invoice — DC-92

**Operation:** `createInvoice()`

**Input data:**

```json
{
  "vendor_id": "e7b20ed1-cbe0-49b1-95eb-d604e56d7fd0",
  "property_id": "c262217a-6b64-4f4a-ade4-23e26d94ec06",
  "reference_number": "INV-123",
  "date": "2026-10-24",
  "amount": 425.0,
  "due_date": "2026-11-15"
}
```

**Expected saved record information:**

```json
{
  "id": "a1b2c3d4-e5f6-4789-a123-b45678901234",
  "status": "pending"
}
```

The application must validate the required fields and save the invoice to Supabase.

The operation should return enough information to identify the saved invoice and confirm the result.

Once saved, the frontend should display a confirmation message.

New invoices are saved with a `pending` status. Approval, rejection, and mock vendor payment are handled separately.

The exact database operation and returned fields must be verified during implementation.

### Retrieve Invoice — DC-89

**Operation:** `getInvoice(invoiceId)`

**Input:** Existing invoice UUID.

**Expected data:**

```json
{
  "id": "a1b2c3d4-e5f6-4789-a123-b45678901234",
  "vendor_id": "e7b20ed1-cbe0-49b1-95eb-d604e56d7fd0",
  "property_id": "c262217a-6b64-4f4a-ade4-23e26d94ec06",
  "reference_number": "INV-123",
  "date": "2026-10-24",
  "amount": 425.0,
  "due_date": "2026-11-15",
  "status": "pending"
}
```

Returns a previously saved invoice using its unique ID.

The frontend should be able to use this information to reopen or repopulate the invoice form.

The operation must handle missing, invalid, or inaccessible invoice records appropriately.

## 5. Validation and Error Handling

### Input Validation

- Require a vendor and property selection.
- Require a reference number, invoice date, and amount.
- Allow the due date to be omitted.
- Validate IDs, dates, and monetary amounts before saving.
- Confirm the selected vendor and property exist and are accessible to the current user.
- Prevent invalid invoice amounts according to agreed business rules.
- Save new invoices with status `pending`.

### User Feedback

- Display a confirmation after a successful save.
- Show meaningful errors for missing or invalid fields.
- Show an appropriate error when a database operation fails.
- Keep entered information available if saving fails.
- Handle empty vendor and property lists.
- Handle invoice records that cannot be found or accessed.

### Database Error Handling

Supabase client operations generally return a result containing `data` and `error`.

The application should check the operation result before treating a database action as successful.

Errors should be handled consistently and presented to users in understandable language.

The following is an example of a proposed application-level validation error format, not a required native Supabase response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid or incomplete invoice data."
  }
}
```

The team should agree on how validation and database errors are represented in the UI.

### Security

- Require authentication for protected invoice operations.
- Enforce database authorization using appropriate RLS policies.
- Ensure users cannot access or modify records outside their permitted scope.
- Do not rely exclusively on frontend validation or UI access restrictions.
- Use server-side operations for privileged actions when necessary.

Existing RLS policies should be reviewed before relying on them for authorization.

## 6. Integration Dependencies

**Database — DC-15**

The current invoice schema requires `date`, `reference_number`, `vendor_id`, `property_id`, and `amount`.

The `due_date` field is optional.

The database schema and field mappings should be confirmed before implementation.

**Manual Entry — DC-88, DC-90, DC-91, DC-92**

These tasks support property identification, vendor and property selection, and invoice creation.

**Invoice Retrieval — DC-89**

The application must retrieve saved invoices by their IDs to support the MVP save/reload workflow.

**Authorization**

Database operations must follow the application's authentication and Supabase security policies.

Existing RLS policies require review to confirm that access restrictions match the team's intended permissions.

**Implementation**

The team should prefer existing Supabase data access patterns where appropriate.

Custom Next.js route handlers may be introduced when there is a justified need, such as privileged server-side processing.

The agreed data requirements and validation behavior should remain consistent regardless of implementation approach.

**Approval and Mock Payment**

Invoice approval, rejection, and payment through the fictional vendor website are separate workflows within the overall MVP.

Their implementation requirements and authorization rules should be documented in their corresponding Jira issues.

## 7. Next Steps

Review the proposed data operations with Josh and the frontend team, confirm field mappings against DC-15, and test the manual entry workflow using one fictional invoice.

Confirm that:

- DC-90 retrieves available vendors.
- DC-91 retrieves available properties.
- DC-88 provides the selected property ID without an unnecessary lookup.
- DC-92 validates and saves the completed invoice.
- The frontend displays a successful save confirmation.
- Missing or invalid fields display appropriate errors.
- DC-89 retrieves a saved invoice by ID.
- A saved invoice can be reopened with the correct data.
- Database authorization rules are reviewed and tested.
- Approval, rejection, and mock vendor payment remain separate from invoice creation while supporting the overall MVP workflow.

The immediate priority is connecting the manual invoice form to the existing database infrastructure and verifying that invoices can be saved and retrieved.

---

_Draft for team review. Implementation details and security policies remain subject to confirmation._
