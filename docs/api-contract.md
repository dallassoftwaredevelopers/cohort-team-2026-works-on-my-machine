# Works on My Machine — MVP API Contract

**Version:** 1.0 (Draft)  
**Date:** October 24, 2026  
**Team:** CYC Cohort, Team 5  
**Jira:** DC-18  
**Status:** Proposed for team review

## 1. Overview

This document defines the proposed API interfaces between the frontend and backend for manual invoice entry.

The implementation will build on the existing Next.js, CoreUI, and Supabase infrastructure, reusing available components wherever possible.

**Workflow:** Select Vendor → Select Property → Enter Reference Number → Enter Invoice Date → Enter Amount → Enter Due Date → Submit → Save Invoice

Invoice creation is separate from approval, rejection, and EasyPay.

## 2. Data Access Operations

The manual invoice workflow requires the following database operations. The existing application uses the Supabase JavaScript client to interact with the database directly, so custom Next.js API routes are not necessarily required for basic data retrieval and invoice creation.

| Operation               | Database Table | Purpose                                   | Jira  |
| ----------------------- | -------------- | ----------------------------------------- | ----- |
| `getAllVendors()`       | `vendors`      | Populate the vendor combobox              | DC-90 |
| `getAllProperties()`    | `properties`   | Populate the property combobox            | DC-91 |
| `createInvoice()`       | `invoices`     | Validate and save a new invoice           | DC-92 |
| `getInvoice(invoiceId)` | `invoices`     | Retrieve a previously saved invoice by ID | DC-89 |
| `getPropertyId()`       | `properties`   | Obtain the selected property's ID         | DC-88 |

These names describe required operations, not necessarily separate functions that must be implemented.

### Existing Implementation

The Properties page (`frontend/app/properties/page.tsx`) already retrieves records using the Supabase JavaScript client.

This demonstrates an existing database access pattern that may be reused for the manual invoice form.

The remaining operations have not yet been verified as implemented.

### Implementation Considerations

- Review existing functionality before implementing additional database operations.
- Reuse existing Supabase client queries where appropriate.
- Preserve the required input fields, output data, and validation rules.
- Handle database errors and provide useful feedback.
- Enforce access permissions through appropriate Supabase Row Level Security (RLS) policies.
- Use server-side operations when privileged credentials or sensitive business logic require them.
- Reuse the selected property's ID from `getAllProperties()` where available, rather than introducing an unnecessary database lookup.

The implementation approach remains subject to team review..

## 3. API Conventions

- **Format:** JSON
- **Authentication:** Existing application authentication
- **Identifiers:** UUID
- **Dates:** `YYYY-MM-DD`
- **Success responses:** `200 OK`, `201 Created`
- **Money:** USD
- **Error responses:** Standard HTTP status codes with consistent JSON error objects
- **Security:** Authenticate requests and authorize actions

## 4. Request and Response Formats

### Get Vendors

`GET /api/vendors`

**Response: 200 OK**

```json
[
  {
    "id": "e7b20ed1-cbe0-49b1-95eb-d604e56d7fd0",
    "name": "ABC Plumbing"
  }
]
```

Returns available vendors to populate the Vendor combobox.

### Get Properties

`GET /api/properties`

**Response: 200 OK**

```json
[
  {
    "id": "c262217a-6b64-4f4a-ade4-23e26d94ec06",
    "name": "Example Property"
  }
]
```

Returns available properties to populate the Property combobox.

### Save Invoice

`POST /api/invoices`

**Request:**

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

**Response: 201 Created**

```json
{
  "id": "a1b2c3d4-e5f6-4789-a123-b45678901234",
  "status": "pending"
}
```

The backend checks the required fields, validates the vendor and property selections, and saves the invoice to Supabase.

Once saved, the frontend should display a confirmation message.

New invoices are saved with a `pending` status. Approval and payment are handled separately.

### Retrieve Invoice

`GET /api/invoices/{id}`

**Response: 200 OK**

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

Returns the saved invoice using its ID. This allows the frontend to confirm the invoice was saved and retrieve it later.

## 5. Validation and Error Handling

- Require a vendor and property selection.
- Require a reference number, invoice date, and amount.
- Due date is optional.
- Validate IDs, dates, and monetary amounts before saving.
- Confirm the selected vendor and property exist and are accessible.
- Save new invoices with status `pending`.
- Display a confirmation after a successful save.
- Show appropriate errors for missing fields or failed submissions.
- Keep entered information available if saving fails.
- Enforce authentication and authorization server-side.

**Standard error response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid or incomplete invoice data."
  }
}
```

Relevant status codes: `400`, `401`, `403`, `404`, `422`, `500`.

## 6. Integration Dependencies

**Database:** The current schema requires `date`, `reference_number`, `vendor_id`, `property_id`, and `amount`.

**Manual Entry:** DC-90 (`getAllVendors()`), DC-91 (`getAllProperties()`), and DC-92 (`createInvoice()`) support the manual entry form.

**Authorization:** Requests must follow the application's authentication and Supabase security policies. Database permissions should be reviewed before using real data.

**Implementation:** Next.js route handlers or appropriate Supabase operations can be used, provided the agreed request and response formats remain consistent.

## 7. Next Steps

Review the proposed interfaces with the frontend and backend teams, confirm the field mappings against DC-15, and test the manual entry workflow using one fictional invoice.

Confirm that:

- DC-90 populates the Vendor combobox.
- DC-91 populates the Property combobox.
- DC-92 validates and saves the completed invoice.
- The frontend displays a successful save confirmation.
- Missing or invalid fields display an appropriate error.
- A saved invoice can be retrieved by ID.
- Approval and EasyPay remain separate from invoice creation.

The priority is getting the manual entry form connected and saving invoices using the existing infrastructure.

---

_Draft for team review._
