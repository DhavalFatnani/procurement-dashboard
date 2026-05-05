# KNOT — Warehouse Procurement & Serial Governance System
## Cursor Development Prompts — Phase-by-Phase

---

## HOW TO USE THIS FILE

Each prompt is a self-contained Cursor instruction. Paste it directly into the Cursor chat.
Every prompt assumes the previous phase is complete and committed. Do not skip phases —
each one lays the foundation the next one depends on.

**Stack used throughout:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase (Postgres + Auth + Storage)
- Prisma ORM

**Conventions used throughout:**
- All DB interactions go through Prisma — no raw SQL in components
- Role is stored on the session user object as `user.role` — values: `SM` | `OPS_HEAD` | `FINANCE`
- All server actions live in `/app/actions/`
- All shared types live in `/types/`
- Components are never aware of role logic directly — role-gating happens at layout/page level via `checkRole()` helper

---

## PHASE 0 — PROJECT SCAFFOLD & DATABASE

### Prompt 0.1 — Project Init & Tech Stack Setup

```
Scaffold a new Next.js 14 project called `knot-procurement` using the App Router.

Install and configure:
- TypeScript
- Tailwind CSS
- shadcn/ui (init with default theme, slate base color)
- Prisma with a Supabase Postgres connection
- Supabase Auth (email/password only — no OAuth needed)
- Supabase Storage (for invoice and payment proof file uploads)

File structure to create:
/app
  /actions         ← all server actions
  /api             ← API routes if needed
  /(auth)          ← login page
  /(dashboard)     ← all protected screens
/components
  /ui              ← shadcn components (auto-populated)
  /shared          ← reusable app components
/lib
  supabase.ts      ← supabase client
  prisma.ts        ← prisma client singleton
  auth.ts          ← session helpers + checkRole()
/types
  index.ts         ← shared TypeScript types

Create a `checkRole(allowedRoles: Role[])` helper in `/lib/auth.ts` that:
- Reads the current session from Supabase Auth
- Returns the user object with role attached
- Throws a redirect to /login if no session
- Throws a redirect to /unauthorized if role is not in allowedRoles

Roles are: SM | OPS_HEAD | FINANCE — stored as an enum in Supabase user metadata.
```

---

### Prompt 0.2 — Full Database Schema

```
Create the complete Prisma schema for the KNOT Procurement system.

Define the following models exactly:

--- ENUMS ---

Role: SM | OPS_HEAD | FINANCE
PRStatus: DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | REVISION_REQUIRED | CONVERTED_TO_PO | EXECUTED_PRINT | CANCELLED | FORCE_CANCELLED
ExecutionType: VENDOR_PURCHASE | INTERNAL_PRINT
POStatus: OPEN | PARTIALLY_RECEIVED | FULLY_RECEIVED | INVOICED | PAID | CLOSED | PARTIALLY_CLOSED | FORCE_CLOSED
GRNExceptionType: DAMAGED | WRONG_ITEM | QUANTITY_SHORT | QUALITY_REJECTION
GRNExceptionResolution: ACCEPTED | RETURNED_TO_VENDOR | OVERRIDE_ACCEPTED
InvoiceMatchStatus: PENDING | MATCHED | MISMATCH | OVERRIDE_ACCEPTED
PaymentStatus: UNPAID | PARTIALLY_PAID | PAID
VendorStatus: ACTIVE | INACTIVE
VendorRequestStatus: PENDING | ACTIVATED | REJECTED
SerialSeries: LOCK_TAGS | JEWELLERY_BARCODES | APPAREL_BARCODES
SerialReservationStatus: PENDING | RESERVED
SeriesConfigStatus: ACTIVE | INACTIVE | WARNING

--- MODELS ---

User {
  id, email, name, role (Role), warehouseId, createdAt
}

Warehouse {
  id, name, location, createdAt
}

Vendor {
  id, businessName, gst?, address?, pocName, phone, email,
  accountName, accountNumber, ifsc, bankName,
  status (VendorStatus, default ACTIVE),
  hasSimilarVendorFlag (Boolean, default false),
  similarVendorId (String?),
  createdById, createdAt, updatedAt
  — relations: purchaseOrders, vendorChangeLogs, vendorRequests
}

VendorChangeLog {
  id, vendorId, fieldName, oldValue, newValue,
  changedById, changedAt, reason
}

VendorRequest {
  id, businessName, pocName, phone, email,
  status (VendorRequestStatus, default PENDING),
  requestedById, reviewedById?, reviewReason?,
  linkedPRId?, activatedVendorId?,
  createdAt, updatedAt
}

Category {
  id, name
  — relations: subcategories
}

Subcategory {
  id, categoryId, name, series (SerialSeries?), executionType (ExecutionType)
}

PurchaseRequest {
  id (auto-generated, prefix PR-), categoryId, subcategoryId,
  quantity (Int), warehouseId, vendorId?,
  executionType (ExecutionType), status (PRStatus, default DRAFT),
  currentVersion (Int, default 1), revisionCount (Int, default 0),
  vendorRequestId?,
  createdById, createdAt, updatedAt
  — relations: versions, purchaseOrder, serialReservation
}

PRVersion {
  id, prId, versionNumber, changedById, changedAt,
  revisionComment?, diffSnapshot (Json)
}

PurchaseOrder {
  id (auto-generated, prefix PO-), prId, vendorId,
  orderedQty (Int), unitPrice (Decimal?),
  status (POStatus, default OPEN),
  expectedDelivery (DateTime?),
  deliveryComplete (Boolean, default false),
  forceClosedById?, forceCloseReason?,
  createdAt, updatedAt
  — relations: grns, invoices, serialReservation
}

GoodsReceipt {
  id, poId, receivedQty (Int), acceptedQty (Int), disputedQty (Int, default 0),
  receivedById, receivedAt, deliveryNoteRef?,
  createdAt
  — relations: exceptions, invoiceLinks
}

GRNException {
  id, grnId, exceptionType (GRNExceptionType), exceptionQty (Int),
  note, resolutionStatus (GRNExceptionResolution?),
  resolvedById?, resolvedAt?, resolutionNote?,
  createdAt
}

Invoice {
  id, poId, invoiceNumber, amount (Decimal), invoiceDate (DateTime),
  fileUrl, uploadedById,
  matchStatus (InvoiceMatchStatus, default PENDING),
  expectedAmount (Decimal?), tolerancePct (Decimal, default 2.5),
  overrideById?, overrideReason?,
  paymentStatus (PaymentStatus, default UNPAID),
  createdAt, updatedAt
  — relations: grnLinks, payment
}

InvoiceGRNLink {
  id, invoiceId, grnId
}

Payment {
  id, invoiceId, status (PaymentStatus), method?,
  proofUrl?, transactionRef?, paidById?, paidAt,
  createdAt, updatedAt
}

SerialReservation {
  id, series (SerialSeries), rangeStart (BigInt), rangeEnd (BigInt),
  quantity (Int), warehouseId, status (SerialReservationStatus, default PENDING),
  prId?, poId?,
  idempotencyKey (String, unique),
  createdById, createdAt
}

SeriesConfig {
  id, series (SerialSeries, unique),
  inactivityThresholdDays (Int, default 30),
  ceilingNumber (BigInt),
  ceilingAlertPct (Int, default 80),
  configuredById, configuredAt
}

After writing the schema, run:
npx prisma generate
npx prisma db push

Then seed the database with:
- 3 warehouse records (Warehouse A, B, C)
- 3 user accounts (one per role) linked to Supabase Auth users
- Category + Subcategory master data:
  Packaging → [Primary Packaging (Zip lock Bag), Secondary Packaging (Courier Bag), Tertiary Packaging (Paper Bag)]
  Warehouse Maintenance → [Electrical items, Racks - Slotted Angle, Racks - HDR, Cleaning supplies, Tools, Repairs, Safety items, Stationary items]
  Lock Tags → [Apparel Lock Tags (series: LOCK_TAGS, executionType: VENDOR_PURCHASE), Jewellery Barcodes (series: JEWELLERY_BARCODES, executionType: INTERNAL_PRINT), Accessories & Apparel Barcodes (series: APPAREL_BARCODES, executionType: INTERNAL_PRINT)]
- SeriesConfig records for all 3 series with default thresholds
```

---

### Prompt 0.3 — Auth, Layout Shell & Role-Based Navigation

```
Build the authentication and app shell for the KNOT Procurement system.

1. LOGIN PAGE at /app/(auth)/login/page.tsx
- Email + password form using shadcn Input, Button, Card
- Calls Supabase Auth signInWithPassword
- On success: redirect to /dashboard
- On failure: show inline error message
- No registration page needed — users are seeded manually

2. ROOT LAYOUT with role-based sidebar at /app/(dashboard)/layout.tsx
- Check session using checkRole([]) — redirect to /login if no session
- Render a persistent left sidebar with navigation items
- Sidebar items render conditionally based on user.role:

  SM sees: Dashboard, Vendors (read-only), Purchase Requests, Purchase Orders (read-only), Goods Receipt, Invoices (upload only), Serial Governance, Reports (limited)
  OPS_HEAD sees: Dashboard, Vendors, Purchase Requests, Purchase Orders, Goods Receipt, Invoices, Payments (view only), Serial Governance, Reports (full)
  FINANCE sees: Dashboard, Purchase Orders (read-only, limited), Invoices, Payments, Reports (payment only)

- Sidebar shows: app name "KNOT Procurement", user name, user role badge, nav links with icons, logout button at bottom
- Active route is highlighted
- Use shadcn Sheet for mobile sidebar (hamburger toggle)

3. UNAUTHORIZED PAGE at /app/unauthorized/page.tsx
- Simple page shown when a user tries to access a route their role cannot see
- Shows their current role and a back to dashboard link

4. SHARED COMPONENTS to create now (used across all phases):
- /components/shared/PageHeader.tsx — title + optional subtitle + optional right-side action button slot
- /components/shared/StatusBadge.tsx — renders colored badge given a status string. Map each PRStatus, POStatus, PaymentStatus, InvoiceMatchStatus to a color
- /components/shared/DataTable.tsx — generic table wrapper using shadcn Table with columns prop, data prop, optional row click handler
- /components/shared/EmptyState.tsx — empty state illustration + message + optional CTA button
- /components/shared/ConfirmDialog.tsx — shadcn AlertDialog wrapper with title, description, confirm button label, onConfirm callback
```

---

## PHASE 1 — VENDOR MANAGEMENT

### Prompt 1.1 — Vendor List & Add Vendor

```
Build the Vendors screen for the KNOT Procurement system.

ROUTE: /app/(dashboard)/vendors/page.tsx
ACCESS: OPS_HEAD (full), SM (read-only — no Add/Edit/Deactivate actions visible)

VENDOR LIST VIEW:
- Use the shared DataTable component
- Columns: Vendor Name, POC Name, Phone, Email, Bank Details (show "••••" + last 4 of account number), Status badge (Active/Inactive), Created By, Last Updated
- Row actions (OPS_HEAD only): View Details (always), Edit, Deactivate
- Top bar: "Add Vendor" button (OPS_HEAD only) + Search input (searches name/phone/email) + Status filter dropdown (All / Active / Inactive / Pending)
- Two tabs: "All Vendors" and "Pending Requests" (OPS_HEAD only — hidden for SM)
- Pending Requests tab: shows VendorRequest records with status PENDING — columns: Business Name, POC Name, Phone, Requested By, Linked PR, Date. Row actions: Review (opens review drawer)

ADD VENDOR — opens as a right-side Sheet (not a new page):
- Section: Basic Info — Vendor Business Name (required), GST (optional), Address (optional)
- Section: Contact — POC Name (required), Phone (required), Email (required)
- Section: Bank Details — Account Name, Account Number, IFSC, Bank Name (all required)
- Validation on submit:
  TIER 1 (hard block): Check DB for exact match on phone, email, or GST. If found, show inline error: "A vendor with this [field] already exists — [Vendor Name]. View existing vendor." Form cannot be submitted until the conflicting field is changed.
  TIER 2 (fuzzy): Run Jaro-Winkler similarity on businessName against all existing vendor names (use the `natural` npm package for Jaro-Winkler). If similarity > 0.85, show a warning panel listing similar vendors with their details. Render a checkbox: "I confirm this is a different vendor from those listed above." and a free-text Reason field. Both are required before save is enabled. Log this acknowledgment to VendorChangeLog with fieldName: "DUPLICATE_WARNING_ACKNOWLEDGED".
- On save: create Vendor record, close Sheet, refresh list

SERVER ACTION at /app/actions/vendors.ts:
- createVendor(data) — runs tier 1 check, creates vendor, returns vendor or error
- getVendors(filters) — returns paginated vendor list with search/filter
- getPendingVendorRequests() — returns VendorRequest records with status PENDING
```

---

### Prompt 1.2 — Vendor Detail, Edit & Deactivate

```
Build the Vendor Detail page and Edit flow for the KNOT Procurement system.

ROUTE: /app/(dashboard)/vendors/[id]/page.tsx
ACCESS: OPS_HEAD (full), SM (read-only)

VENDOR DETAIL PAGE:
Four sections rendered as cards:

1. Basic Info card — Business Name, GST, Address. Edit button (OPS_HEAD only) opens Edit Sheet
2. Contact Details card — POC Name, Phone, Email
3. Bank Info card — Account Name, masked account number (show ••••XXXX), IFSC, Bank Name. Note: full account number never displayed in UI
4. Linked Purchase History card — table of all POs linked to this vendor: PO ID, Status, Created Date, Total Value. Empty state if none.

Below the cards, two tabs:
- Tab 1: "Edit History" (OPS_HEAD only) — table showing VendorChangeLog entries: Field Changed, Old Value, New Value, Changed By, Date, Reason. Sensitive fields (account number) show last 4 digits only in old/new value columns.
- Tab 2: "Linked POs" — same as Linked Purchase History card but paginated

If vendor has hasSimilarVendorFlag = true, show a yellow banner at the top:
"Similar vendor exists: [similar vendor name]. Review or merge."
With a "Merge Vendors" button that opens a ConfirmDialog:
"Merge [Vendor B] into [Vendor A]? All purchase orders from [Vendor B] will be re-linked to [Vendor A]. [Vendor B] will be deactivated."
On confirm: re-link all POs, deactivate Vendor B, write merge event to VendorChangeLog.

EDIT VENDOR — opens as a right-side Sheet:
- Editable fields: POC Name, Phone, Email, Address, Bank Details (Account Name, Account Number, IFSC, Bank Name)
- Non-editable (shown as read-only text): Vendor Business Name
- Mandatory "Reason for this edit" textarea — non-optional, form cannot submit without it
- On save: write all changed fields to VendorChangeLog (one entry per changed field), update Vendor record
- Re-run Tier 1 and Tier 2 duplicate checks on phone/email/GST changes

DEACTIVATE / REACTIVATE:
- Deactivate button (OPS_HEAD only) shows ConfirmDialog: "Deactivate [Vendor Name]? This prevents future purchases but keeps all history intact."
- On confirm: set status = INACTIVE. Vendor stays visible in old POs but cannot be selected in new PRs.
- If vendor is INACTIVE, show "Reactivate" button instead. On click: set status = ACTIVE.

SERVER ACTIONS additions to /app/actions/vendors.ts:
- getVendorById(id) — full vendor object with change log and POs
- updateVendor(id, data, reason) — write change log per field, update vendor
- deactivateVendor(id) — set INACTIVE
- reactivateVendor(id) — set ACTIVE
- mergeVendors(primaryId, secondaryId) — re-link POs, deactivate secondary, write merge log
- reviewVendorRequest(requestId, action: ACTIVATED|REJECTED, reason?) — activate or reject pending vendor request
```

---

## PHASE 2 — PURCHASE REQUESTS

### Prompt 2.1 — PR List View & Status Engine

```
Build the Purchase Requests list screen for the KNOT Procurement system.

ROUTE: /app/(dashboard)/purchase-requests/page.tsx
ACCESS: OPS_HEAD (full), SM (full — sees all PRs from their warehouse)

PR LIST VIEW:
- Use shared DataTable
- Columns: PR ID, Category, Subcategory, Warehouse, Quantity, Vendor (blank if Internal Print), Execution Type badge, Status badge, Version (V1/V2/V3), Created By, Created On
- Clicking a row navigates to /purchase-requests/[id]
- Top bar: "Create PR" button + filters:
  Status (multi-select), Category, Subcategory, Execution Type, Warehouse (OPS_HEAD only — SM sees their own warehouse auto-filtered), Date Range, Created By (OPS_HEAD only)

INLINE APPROVAL ACTIONS (OPS_HEAD only, visible in list):
For rows where executionType = VENDOR_PURCHASE and status = PENDING_APPROVAL:
Show three action buttons inline in the row: "Approve" | "Reject" | "Send for Revision"
- Approve: ConfirmDialog → on confirm: set status = APPROVED, trigger createPOFromPR() server action
- Reject: opens a small popover with a mandatory reason textarea → on submit: set status = REJECTED, write reason to PRVersion
- Send for Revision: opens a popover with a mandatory revision comment textarea → on submit: set status = REVISION_REQUIRED, write PRVersion entry with revisionComment

STATUS ENGINE — create a utility at /lib/prStatus.ts:
Export a function evaluatePRStatus(pr) that returns the correct next status and validates transitions.
Allowed transitions:
  DRAFT → PENDING_APPROVAL (on SM submit)
  DRAFT → CANCELLED (on SM cancel)
  PENDING_APPROVAL → APPROVED (on OPS_HEAD approve)
  PENDING_APPROVAL → REJECTED (on OPS_HEAD reject)
  PENDING_APPROVAL → REVISION_REQUIRED (on OPS_HEAD send for revision)
  PENDING_APPROVAL → CANCELLED (on SM cancel)
  REVISION_REQUIRED → PENDING_APPROVAL (on SM resubmit) — only if revisionCount < 3
  REVISION_REQUIRED → FORCE_CANCELLED (if revisionCount >= 3 on resubmit attempt)
  APPROVED → CONVERTED_TO_PO (on PO creation)
  DRAFT/PENDING_APPROVAL → CANCELLED
  Internal Print: DRAFT → EXECUTED_PRINT (on print confirmation)
Any other transition throws an error.

SERVER ACTIONS at /app/actions/purchase-requests.ts:
- getPurchaseRequests(filters) — paginated list with filters
- approvePR(prId) — validate transition, set APPROVED, call createPOFromPR()
- rejectPR(prId, reason) — validate transition, set REJECTED, write PRVersion
- sendForRevision(prId, revisionComment) — validate transition, set REVISION_REQUIRED, write PRVersion with comment, increment revisionCount
- createPOFromPR(prId) — create PurchaseOrder from approved PR, set PR status to CONVERTED_TO_PO
```

---

### Prompt 2.2 — Create PR Form

```
Build the Create Purchase Request form for the KNOT Procurement system.

ROUTE: /app/(dashboard)/purchase-requests/new/page.tsx
ACCESS: SM, OPS_HEAD

The form is divided into 4 sections rendered as a single-page stepped form (not a wizard — all sections visible, but sections below unlock as the previous section is completed):

SECTION 1 — Category Selection:
- Category dropdown — loads all Categories from DB
- Subcategory dropdown — dynamically loads Subcategories filtered by selected Category
- On subcategory selection: system reads the subcategory's executionType and series, stores in form state (not displayed as a field — used to control section 4 and form actions)

SECTION 2 — Request Details:
- Quantity — numeric input, min 1, required
- Warehouse — auto-filled from logged-in user's warehouseId, shown as read-only text (not a dropdown)

SECTION 3 — Vendor (conditional):
- Only visible when executionType = VENDOR_PURCHASE
- Vendor dropdown — loads only ACTIVE vendors
- "+ Request New Vendor" link below the dropdown
  On click: opens a Sheet with a trimmed vendor request form: Business Name (required), POC Name (required), Phone (required), Email (required)
  On submit: creates VendorRequest record with status PENDING and linkedPRId = current draft PR id (or null if PR not yet saved)
  After submission: show inline message "Vendor request submitted. Ops Head will review. You can save this PR as a draft and submit once the vendor is activated."
  The vendor dropdown should show a disabled option "Pending: [Business Name] — awaiting activation" for the pending request
  PR cannot be submitted for approval while vendorRequestId is set and VendorRequest.status = PENDING

SECTION 4 — Lock Tag Logic (conditional):
- Only visible when category = Lock Tags
- Shows a read-only System Suggestion Panel:
  "Series: [series name based on subcategory]"
  "Execution Type: [Vendor Purchase / Internal Print]"
  "Recommended action: [Purchase from vendor / Print internally]"
  "Last reserved range end: [fetched from latest SerialReservation for this series]"
  "Next available start: [last_end + 1]"
- This panel is informational only — no user input

FORM ACTIONS (dynamic based on executionType):

If executionType = VENDOR_PURCHASE:
- "Save as Draft" button — creates/updates PR with status DRAFT
- "Submit for Approval" button — validates all required fields, creates/updates PR with status PENDING_APPROVAL, creates PRVersion V1

If executionType = INTERNAL_PRINT:
- "Save as Draft" button
- "Confirm & Continue" button — validates fields, opens a Confirmation Modal:
  Modal content: "You are about to reserve a serial range."
  Series: [series name]
  Quantity: [qty]
  Estimated range: [next_start] to [next_start + qty - 1]
  Warehouse: [warehouse name]
  Two buttons: "Confirm Print" and "Cancel"
  On "Confirm Print": call atomicReserveSerialRange() server action (see Phase 5), redirect to Print Execution screen

SERVER ACTIONS additions to /app/actions/purchase-requests.ts:
- createPR(data) — create PR with DRAFT status, return prId
- updatePR(prId, data) — update draft PR fields
- submitPR(prId) — validate, transition to PENDING_APPROVAL, write PRVersion V1
- cancelPR(prId) — validate cancellation is allowed (status must be DRAFT or PENDING_APPROVAL), set CANCELLED
- createVendorRequest(data, prId?) — create VendorRequest, link to PR if provided
```

---

### Prompt 2.3 — PR Detail Page & Revision Flow

```
Build the Purchase Request detail page for the KNOT Procurement system.

ROUTE: /app/(dashboard)/purchase-requests/[id]/page.tsx
ACCESS: OPS_HEAD (full), SM (own PRs + revision actions)

PR DETAIL PAGE — layout: two-column on desktop (main left, timeline right):

LEFT COLUMN — four cards:

Card 1: Request Summary
- Category, Subcategory, Quantity, Warehouse, Execution Type badge, Vendor (if applicable), Current Status badge
- If status = REVISION_REQUIRED: show a yellow alert box at the top of this card:
  "Revision requested by [Ops Head name] on [date]"
  "[Revision comment text]"
  This is the most prominent element on the page when revision is required

Card 2: Procurement Progress (vendor purchase only — hidden for internal print)
- Four step indicators: PR Approved → PO Created → GRN Recorded → Invoice Uploaded → Payment Received
- Each step shows status and date completed

Card 3: Print Execution Info (internal print only — hidden for vendor purchase)
- Series, Reserved range (Start → End), Quantity printed, Printed by, Printed on
- Link to Batch record in Print History: "View Batch [batchId] in Serial Governance →"

Card 4: Version History (collapsible)
- List of all PRVersion entries for this PR in reverse chronological order
- Each entry: V[n] — [action] by [user] on [date] — [revision comment if any]

RIGHT COLUMN — action panel (conditional by role and status):

SM actions:
- Status = DRAFT: Edit PR button, Submit for Approval button, Cancel PR button
- Status = REVISION_REQUIRED: Edit fields reopen (see revision form below), Resubmit for Approval button, Cancel PR button
- Status = PENDING_APPROVAL: Cancel PR button only (edit locked)
- All other statuses: no actions

OPS_HEAD actions:
- Status = PENDING_APPROVAL (vendor purchase): Approve, Reject (with reason popover), Send for Revision (with comment popover)
- All statuses: Force Close link (visible but only active on appropriate statuses)

REVISION FORM (SM, status = REVISION_REQUIRED):
The following fields become editable inline on the detail page (not a separate page):
- Category dropdown, Subcategory dropdown, Quantity input, Vendor dropdown
Non-editable: Warehouse (read-only), Execution Type (read-only), PR ID (read-only)
"Resubmit for Approval" button:
- Validates required fields
- Checks revisionCount: if < 3, transition to PENDING_APPROVAL, write PRVersion with diff snapshot (compare new values to previous version values), increment revisionCount, increment currentVersion
- If revisionCount >= 3 on this resubmit: set status = FORCE_CANCELLED, write PRVersion with note "Force cancelled after 3 revision cycles"

SERVER ACTIONS additions:
- getPRById(id) — full PR with versions, vendor, category, subcategory, PO, serial reservation
- resubmitPR(prId, updatedData) — validate revision transition, write diff to PRVersion, update PR, check revision cycle limit
```

---

## PHASE 3 — PURCHASE ORDERS & GRN

### Prompt 3.1 — Purchase Orders

```
Build the Purchase Orders screen for the KNOT Procurement system.

ROUTE: /app/(dashboard)/purchase-orders/page.tsx and /[id]/page.tsx
ACCESS: OPS_HEAD (full), SM (read-only), FINANCE (read-only, limited columns)

PO LIST VIEW:
- Columns: PO ID, Linked PR, Vendor, Delivery Status, Invoice Status, Payment Status badge, Expected Delivery, PO Status badge
- Status progression displayed as a mini stepper in each row: Open → Partially Received → Fully Received → Invoiced → Paid → Closed
- Filters: Status, Vendor, Date Range, Warehouse
- FINANCE view hides: Linked PR column, Warehouse column

PO DETAIL PAGE — three-column layout:

TOP SECTION — Live Reconciliation Panel (the most important element on this page):
Four metric cards side by side:
  "Ordered" → orderedQty
  "Received" → sum of all GRN acceptedQty for this PO
  "Invoiced" → sum of all Invoice amounts linked to this PO
  "Paid" → sum of all Payment amounts for this PO
Below the cards: PO Status badge + auto-close status indicator:
  Show which of the 4 closure conditions are met (green checkmark) and which are not (gray circle):
  ✓/○ Delivery complete
  ✓/○ Invoiced matches received value (within tolerance)
  ✓/○ All invoices paid
  ✓/○ No disputed invoices

MAIN SECTIONS (cards):

Card 1: Vendor Snapshot — vendor name, POC, phone, email. Link to vendor detail page.

Card 2: Order Details — PR ID (linked), Category, Subcategory, Ordered Qty, Unit Price (if set), Expected Delivery (editable by OPS_HEAD)

Card 3: Serial Range Reference (Lock Tags only, read-only) — Series, Reserved range Start → End, Reservation status

Card 4: GRN List — table of all GRNs for this PO:
Columns: GRN ID, Received Qty, Accepted Qty, Disputed Qty, Received By, Date, Exception status
If any GRN has disputedQty > 0: show a red "Open Disputes" badge. Clicking it expands the GRN row to show the exception detail and, for OPS_HEAD, a resolution panel:
  Resolution options (radio buttons): Accept dispute | Return to vendor | Override and accept
  If "Override and accept": mandatory reason textarea appears
  Confirm button writes to GRNException with resolutionStatus

Card 5: Invoice List — table of all invoices for this PO:
Columns: Invoice ID, GRNs covered, Amount, Expected Amount, Match Status badge, Payment Status badge, Uploaded by, Date
OPS_HEAD can override a mismatch: "Override match" button opens a mandatory reason popover

OPS_HEAD ACTIONS (bottom of page):
- Mark delivery complete — ConfirmDialog → sets deliveryComplete = true on PO, triggers auto-close evaluation
- Force Close — ConfirmDialog with mandatory reason textarea → sets status = FORCE_CLOSED, writes forceCloseReason

PO AUTO-CLOSE ENGINE — create /lib/poAutoClose.ts:
Export evaluatePOClosure(poId) — runs after every GRN, invoice, or payment event:
  Fetches PO with all GRNs, invoices, payments
  Checks all 4 conditions:
    1. po.deliveryComplete OR sum(grn.acceptedQty) >= po.orderedQty
    2. sum(invoices.amount) is within tolerance of sum(grn.acceptedQty) * po.unitPrice (if unitPrice set)
    3. sum(payments.amount) >= sum(invoices.amount where paymentStatus != UNPAID)
    4. No GRNException with resolutionStatus = null
  If all 4 met: set PO status = CLOSED
  If conditions 2,3,4 met but condition 1 not (short-shipment): set status = PARTIALLY_CLOSED
  Otherwise: set appropriate intermediate status (PARTIALLY_RECEIVED, FULLY_RECEIVED, INVOICED, PAID) based on furthest completed stage

SERVER ACTIONS at /app/actions/purchase-orders.ts:
- getPurchaseOrders(filters)
- getPOById(id)
- markDeliveryComplete(poId)
- forceClosePO(poId, reason)
- overrideInvoiceMatch(invoiceId, reason)
- resolveGRNException(exceptionId, resolution, note?)
- evaluatePOClosure(poId) — calls the auto-close engine
```

---

### Prompt 3.2 — Goods Receipt (GRN)

```
Build the Goods Receipt screen for the KNOT Procurement system.

ROUTE: /app/(dashboard)/goods-receipt/page.tsx (list) and /new/page.tsx (entry form)
ACCESS: OPS_HEAD (full), SM (full)

GRN LIST VIEW:
- Columns: GRN ID, Linked PO, Vendor, Received Qty, Accepted Qty, Disputed Qty, Exception Status, Received By, Date
- Filter: PO, Vendor, Date Range, Has Exceptions (Yes/No)
- Clicking a row shows GRN detail in a side Sheet

GRN ENTRY FORM (/new):
The form has a PO selector at the top that drives everything below it.

Step 1 — PO Selection:
- PO dropdown — shows only OPEN and PARTIALLY_RECEIVED POs
- On PO select: auto-loads and displays read-only:
  Vendor name, Ordered qty, Previously received qty (sum of all prior GRNs for this PO), Pending qty (ordered - received)
  If PO category = Lock Tags: show a read-only info box:
    "Serial Range on this PO: [rangeStart] to [rangeEnd] ([series name])"
    "Use this range to cross-check physical tags received."

Step 2 — Receipt Entry:
- Received Qty (numeric, required) — cannot exceed pending qty, validated on input
- Receipt Date (date picker, required, defaults to today)
- Delivery Note / Challan Reference (text input, optional)
- Received By: auto-filled from logged-in user, shown as read-only

Step 3 — Exception Flagging (optional):
- "Flag an exception on this receipt" toggle (off by default)
- When toggled on, reveal:
  Exception Type dropdown: Damaged | Wrong item received | Quantity short of delivery note | Quality rejection
  Exception Quantity (numeric, required if toggle on) — must be ≤ received qty
  Exception Note (textarea, required if toggle on) — non-optional
  Inline validation: "Accepted qty will be [received - exception] and disputed qty will be [exception]. These must sum to [received]."

On Submit:
- Validate accepted_qty + disputed_qty = received_qty (server-side enforced)
- Create GoodsReceipt record
- If exception toggled: create GRNException record linked to the GRN
- Call evaluatePOClosure(poId) from the PO auto-close engine
- Redirect to the linked PO detail page

SERVER ACTIONS at /app/actions/grn.ts:
- getGRNs(filters)
- getGRNById(id)
- createGRN(data) — validates quantities, creates GRN + exception if present, triggers evaluatePOClosure
- getPOsForGRN() — returns POs eligible for GRN (status OPEN or PARTIALLY_RECEIVED)
```

---

## PHASE 4 — INVOICES & PAYMENTS

### Prompt 4.1 — Invoices

```
Build the Invoices screen for the KNOT Procurement system.

ROUTE: /app/(dashboard)/invoices/page.tsx (list) and /new/page.tsx (upload form)
ACCESS: OPS_HEAD (full), SM (upload only), FINANCE (full access — primary working screen)

INVOICE LIST VIEW:
- Columns: Invoice ID, Linked PO, Vendor, GRNs covered, Invoice Amount, Expected Amount, Match Status badge, Payment Status badge, Uploaded By, Date
- Filters: Match Status, Payment Status, Vendor, Date Range, PO
- SM view: can see invoices they uploaded. Can upload new invoices.
- FINANCE view: full list, no upload button, primary read/action screen

INVOICE UPLOAD FORM (/new):
- PO selector (required) — loads POs that have at least one GRN recorded
- GRN selector (multi-select, required) — loads GRNs for selected PO that are not fully invoiced yet
  Shows each GRN with: GRN ID, Received date, Accepted Qty, Already invoiced? (Yes/No)
  If a GRN has disputedQty > 0: show "(X units disputed — excluded from invoiceable amount)"
  User selects one or more GRNs that this invoice covers
- Invoice Number (text, required)
- Invoice Amount (decimal, required)
- Invoice Date (date picker, required)
- File Upload (PDF/image, required) — uploads to Supabase Storage, stores fileUrl

MATCH COMPUTATION (real-time as user enters amount):
After GRN selection and amount entry, show a match panel:
  "GRNs selected: [list]"
  "Total accepted qty from selected GRNs: [n] units"
  "Unit price from PO: [price] (if set) | Not set"
  "Expected invoice amount: [accepted_qty × unit_price] (if unit price set) | Cannot compute"
  "Your entered amount: [amount]"
  "Variance: [amount - expected] ([pct]%)"
  Match status indicator:
    Green "MATCHED" if variance is within ±2.5% (default tolerance)
    Red "MISMATCH" if outside tolerance — "This invoice will be flagged. Payment will be blocked until an Ops Head override is recorded."
    Gray "CANNOT VERIFY" if PO unit price is not set

On Submit:
- Create Invoice record with computed matchStatus and expectedAmount
- Create InvoiceGRNLink records (one per selected GRN)
- If matchStatus = MISMATCH: invoice is saved but payment is gated
- Call evaluatePOClosure(poId)
- Redirect to the PO detail page

INVOICE DETAIL (opened as Sheet from list):
- All fields read-only
- Match status with variance explanation
- GRNs covered (list with links)
- Payment status
- If matchStatus = MISMATCH and user is OPS_HEAD: show "Override Match" button → mandatory reason popover → on submit: set matchStatus = OVERRIDE_ACCEPTED, write overrideById and overrideReason

SERVER ACTIONS at /app/actions/invoices.ts:
- getInvoices(filters)
- getInvoiceById(id)
- createInvoice(data) — compute match, create invoice + GRN links, trigger PO closure eval
- getGRNsForPO(poId) — returns GRNs eligible for invoicing (not fully invoiced, accepted_qty > 0)
- overrideInvoiceMatch(invoiceId, reason)
```

---

### Prompt 4.2 — Payments

```
Build the Payments screen for the KNOT Procurement system.

ROUTE: /app/(dashboard)/payments/page.tsx
ACCESS: FINANCE (full control), OPS_HEAD (view only — no update actions)

PAYMENTS LIST VIEW:
- Columns: Invoice ID, PO ID, Vendor, Invoice Amount, Match Status badge, Payment Status badge, Method, Transaction ID, Paid By, Paid Date, Actions
- Filters: Payment Status, Vendor, Date Range, Match Status
- FINANCE sees: all columns + update action buttons
- OPS_HEAD sees: all columns, no action buttons
- SM: no access to this screen

VENDOR CHANGE FLAG:
For each row where the linked vendor's updatedAt is AFTER the linked PO's createdAt:
Show a yellow warning icon in the Vendor column. On hover/click: tooltip showing:
"Vendor details were updated on [date] — verify bank details before processing payment."
IFSC is shown in the Vendor column tooltip for Finance to verify — account number remains masked.

PAYMENT UPDATE PANEL (FINANCE only):
Clicking a row that is not PAID opens a side Sheet:

Sheet header: Invoice [ID] — [Vendor Name]

Section 1: Invoice Summary (read-only)
- PO ID, Invoice amount, Expected amount, Match status with variance
- If matchStatus = MISMATCH and no override: show red banner "Payment is gated — invoice has a match mismatch. An Ops Head override is required before you can mark this as paid."
- If matchStatus = MISMATCH (no override): disable all payment action buttons

Section 2: Payment Details (editable)
- Payment Status (select): Unpaid | Partially Paid | Paid
- Payment Method (text input): NEFT / RTGS / UPI / Cheque / etc.
- Transaction Reference (text input, required if status = Paid or Partially Paid)
- Paid Date (date picker, required if status = Paid or Partially Paid)
- Payment Proof (file upload — PDF/image, optional but strongly recommended) — uploads to Supabase Storage

Section 3: Bank Details Verification (read-only, Finance only)
- Account Name: [vendor account name]
- Account Number: ••••[last 4]
- IFSC: [ifsc] ← visible in full on this screen only
- Bank Name: [bank name]
"Verify these details match the invoice before marking as paid."

Save button: updates Payment record, updates Invoice.paymentStatus, calls evaluatePOClosure(poId)

SERVER ACTIONS at /app/actions/payments.ts:
- getPayments(filters)
- updatePayment(invoiceId, data) — validate match status gate, update payment, trigger PO closure eval
- getInvoicePaymentDetail(invoiceId) — full invoice + vendor bank details for payment sheet
```

---

## PHASE 5 — SERIAL GOVERNANCE

### Prompt 5.1 — Atomic Serial Range Reservation

```
Build the atomic serial range reservation engine for the KNOT Procurement system.

This is the most critical piece of the system — it must guarantee no two print requests ever receive overlapping serial ranges, even if triggered simultaneously.

Create /lib/serialReservation.ts with the following exported function:

atomicReserveSerialRange({
  series: SerialSeries,
  quantity: number,
  warehouseId: string,
  createdById: string,
  prId: string,
  idempotencyKey: string
}): Promise<SerialReservation>

Implementation requirements:

1. IDEMPOTENCY CHECK FIRST:
   Check if a SerialReservation already exists for this idempotencyKey.
   If yes: return the existing reservation immediately — do not create a duplicate.
   This handles network retries and double-taps safely.

2. ATOMIC TRANSACTION using Prisma's $transaction with serializable isolation:
   Inside a single Prisma.$transaction(async (tx) => { ... }, { isolationLevel: 'Serializable' }):

   a. Lock-read the latest SerialReservation for this series:
      const latest = await tx.serialReservation.findFirst({
        where: { series },
        orderBy: { rangeEnd: 'desc' }
      })

   b. Calculate new range:
      const rangeStart = latest ? latest.rangeEnd + 1n : getSeriesStartNumber(series)
      const rangeEnd = rangeStart + BigInt(quantity) - 1n

   c. Check ceiling from SeriesConfig:
      const config = await tx.seriesConfig.findUnique({ where: { series } })
      if (config && rangeEnd > config.ceilingNumber) throw new Error('Range ceiling exceeded')

   d. Create the reservation:
      return await tx.serialReservation.create({
        data: {
          series, rangeStart, rangeEnd, quantity, warehouseId,
          status: 'RESERVED', prId, idempotencyKey,
          createdById, createdAt: new Date()
        }
      })

3. SERIES START NUMBERS (hardcoded in getSeriesStartNumber):
   LOCK_TAGS → 100000
   JEWELLERY_BARCODES → 1000000000
   APPAREL_BARCODES → 2000000000

4. ERROR HANDLING:
   - If Serializable transaction fails due to concurrent write conflict: retry once with 200ms delay, then throw a user-friendly error: "Another print request was being processed. Please try again."
   - If ceiling exceeded: throw "Serial range ceiling reached for this series. Contact Ops Head to update the ceiling."
   - Wrap in try/catch and always return a typed result object: { success: boolean, reservation?: SerialReservation, error?: string }

Then build the Print Execution screen:

ROUTE: /app/(dashboard)/purchase-requests/[id]/print/page.tsx
ACCESS: SM, OPS_HEAD

This page is reached after atomicReserveSerialRange completes successfully (called from the Confirm Print modal in the Create PR form).

Page content:
- Success banner: "Serial range reserved successfully"
- Details card: Series, Batch ID (= reservation id), Range Start → Range End, Quantity, Warehouse, Reserved by, Reserved at
- Linked PR: [PR ID] →
- Export options (four buttons):
  "Download CSV" — generates a CSV with one row per serial number in the range (serial number only column)
  "Download PDF" — generates a simple PDF list of serial numbers (use jsPDF npm package)
  "Download Label Format" — generates a tab-separated .txt file with serial numbers for label printing software
  "Copy Range to Clipboard" — copies "Start: X | End: Y | Qty: Z" to clipboard
- "Done — Back to Purchase Requests" button

SERVER ACTIONS at /app/actions/serial.ts:
- reserveSerialRange(data) — calls atomicReserveSerialRange, creates PR execution record, sets PR status to EXECUTED_PRINT
- getSerialReservationByPRId(prId)
- generateSerialCSV(reservationId) — returns CSV string
```

---

### Prompt 5.2 — Serial Governance Dashboard

```
Build the Serial Governance Dashboard for the KNOT Procurement system.

ROUTE: /app/(dashboard)/serial-governance/page.tsx
ACCESS: OPS_HEAD (full — including config), SM (view + print only — no config)

Four-tab layout using shadcn Tabs:

TAB 1: Series Overview
A card per series (3 cards: Lock Tags, Jewellery Barcodes, Apparel Barcodes):

Each card shows:
- Series name and prefix (e.g. "Lock Tags — 00000XXXXX")
- Total ranges reserved (count of SerialReservation records for this series)
- Last reserved range end (BigInt → display as formatted number)
- Last creation event: [type: Purchase/Print] on [date] by [user]
- Range space used: progress bar showing (lastRangeEnd - seriesStart) / (ceiling - seriesStart) × 100%
- Status badge: Active (last event within threshold) | Inactive (beyond threshold) | Range Space Warning (>= alertPct)

OPS_HEAD only — Series Configuration Panel below each card:
Two inputs:
  "Flag as inactive after [X] days of no activity" — number input, saves to SeriesConfig.inactivityThresholdDays
  "Alert when range space reaches [Y]%" — number input (0-100), saves to SeriesConfig.ceilingAlertPct
  "Range ceiling (max serial number)" — BigInt input, saves to SeriesConfig.ceilingNumber
  Save button per series

TAB 2: Warehouse Availability
Table: Series | Warehouse | Number of reservations | Last reserved range end | Last reservation date
Group by series, show all warehouses

TAB 3: Range History
Table: Reservation ID, Series, Range Start, Range End, Quantity, Type (Purchase/Print), Linked PO or PR, Created By, Date
Sortable by date (desc default)
Filters: Series, Type, Warehouse, Date Range

SERIAL NUMBER SEARCH BAR (prominent, above the table):
Text input: "Enter any serial number to find its reservation"
On search: query SerialReservation where rangeStart <= input <= rangeEnd for the correct series (detect series from prefix: starts with 1 → JEWELLERY, starts with 2 → APPAREL, else LOCK_TAGS)
Show result panel: Batch/Reservation ID, Series, Full range (Start → End), Created by, Date, Linked PR/PO with clickable links
If not found: "This serial number has no reservation on record."

TAB 4: Print History
Table: Batch ID (= reservation id), Series, Quantity, Range (Start → End), Printed By, Date, Linked PR ID
Expandable rows: clicking a row expands to show full batch detail + direct link to PR detail page
"View PR [PR-XXX] →" link in each expanded row

SERVER ACTIONS at /app/actions/serial.ts (additions):
- getSeriesOverview() — aggregated stats per series
- getWarehouseAvailability() — series × warehouse breakdown
- getRangeHistory(filters) — paginated range history
- getPrintHistory(filters) — paginated print history
- searchSerialNumber(serialNumber) — returns matching reservation or null
- updateSeriesConfig(series, config) — OPS_HEAD only, updates SeriesConfig
```

---

## PHASE 6 — DASHBOARDS

### Prompt 6.1 — Role-Specific Dashboards

```
Build the three role-specific Dashboard views for the KNOT Procurement system.

ROUTE: /app/(dashboard)/dashboard/page.tsx
The page reads user.role and renders one of three views.

--- OPS HEAD DASHBOARD ---

Row 1 — Four metric cards:
- Pending PR approvals (count of PRs with status PENDING_APPROVAL and executionType VENDOR_PURCHASE)
- Open POs (count of POs with status not CLOSED/PARTIALLY_CLOSED/FORCE_CLOSED)
- Pending payments (count of Invoices with paymentStatus UNPAID)
- Open GRN disputes (count of GRNExceptions with resolutionStatus null)
Each card: number prominently, label below, colored left border (blue/amber/red/orange based on urgency)
Clicking a card navigates to the relevant list screen with the filter pre-applied

Row 2 — Print Activity Summary (3 cards, one per series):
- Series name and prefix
- Last creation event: type + date (or "No activity" if none)
- Range space used: progress bar + percentage
- Status badge: Active | Inactive | Warning
Clicking navigates to Serial Governance → Tab 1 for that series

Row 3 — Alerts panel:
Rendered as a list of alert items. Each alert has: icon, message, timestamp, link to relevant screen.
Alert types to detect:
  - Series inactivity: last event > SeriesConfig.inactivityThresholdDays → "Jewellery Barcodes — no print activity in [N] days"
  - Range space warning: used pct >= SeriesConfig.ceilingAlertPct → "Lock Tag range space at [N]% — review ceiling"
  - POs with unresolved GRN disputes → "PO [ID] — [N] disputed receipt items unresolved"
  - POs with GRN completed but no invoice uploaded (> 7 days) → "PO [ID] — GRN recorded [N] days ago, no invoice uploaded"
If no alerts: show "All clear — no alerts" empty state

Row 4 — Three activity panels side by side:
- Recent PRs: last 5 PRs with status badge and created time
- Recent GRNs: last 5 GRNs with PO link and received time
- Recent print batches: last 5 SerialReservations where prId is set with series and range

--- SM DASHBOARD ---

Row 1 — Three metric cards:
- My open PRs (PRs created by this user, status not CLOSED/CANCELLED/EXECUTED_PRINT/CONVERTED_TO_PO/FORCE_CANCELLED)
- PRs requiring my action (status REVISION_REQUIRED, created by this user) — shown in amber if > 0
- GRNs I recorded this week

Row 2 — Two quick action buttons (large, prominent):
- "Raise Purchase Request" → /purchase-requests/new
- "Record Goods Receipt" → /goods-receipt/new

Row 3 — My recent PRs: table of last 10 PRs by this user with status, category, and action button

--- FINANCE DASHBOARD ---

Row 1 — Backward metrics (2 cards):
- Total paid this month (sum of Payment.amount where paidAt is this month)
- Invoices cleared this week (count of invoices paid this week)

Row 2 — Current state (2 cards):
- Invoices pending payment (count + total value) — red if > 5
- Invoices with disputes flagged (count of invoices where linked PO has unresolved GRN exceptions)

Row 3 — Forward visibility panel (the key Finance-specific section):
Four items in a list, each with count and total value:
  "POs with GRN complete but invoice not yet uploaded" — POs where deliveryComplete=true or fully received, but no invoice exists yet
  "PRs converted to PO in last 7 days" — these will generate invoices soon
  "Open POs with expected delivery in next 14 days" — procurement arriving soon
  "Estimated invoices incoming this week" — derived count: (PRs converted to PO in last 7 days that don't have invoices yet)
Each item has a "View →" link to the relevant filtered screen

SERVER ACTIONS at /app/actions/dashboard.ts:
- getOpsHeadMetrics()
- getSMMetrics(userId)
- getFinanceMetrics()
- getAlerts() — returns typed alert objects for Ops Head dashboard
- getPrintActivitySummary() — returns per-series stats for Ops Head
```

---

## PHASE 7 — REPORTS

### Prompt 7.1 — Reports Screen

```
Build the Reports screen for the KNOT Procurement system.

ROUTE: /app/(dashboard)/reports/page.tsx
ACCESS: OPS_HEAD (all reports), SM (PR History, Serial Usage, Print Logs), FINANCE (PO History limited, Payment Reports)

Layout: left sidebar with report types, right area renders selected report as a filterable table with export.

Available reports (render conditionally based on role):

1. PR History (SM + OPS_HEAD)
Columns: PR ID, Category, Subcategory, Quantity, Vendor, Execution Type, Status, Version, Created By, Created On, Last Updated
Filters: Status, Category, Execution Type, Date Range, Created By (OPS_HEAD only — SM sees own PRs only)

2. PO History (OPS_HEAD + FINANCE limited)
Columns: PO ID, Linked PR, Vendor, Ordered Qty, Delivery Status, Invoice Status, Payment Status, Total Invoiced, Total Paid, Created At, Closed At
FINANCE sees: PO ID, Vendor, Invoice Status, Payment Status, Total Invoiced, Total Paid only

3. Vendor Purchase Summary (OPS_HEAD only)
Grouped by vendor: Vendor Name, Total POs, Total Ordered Value, Total Paid, Open POs count, Last PO date

4. Serial Usage Summary (OPS_HEAD + SM)
Per series: Series Name, Total Reservations, Total Qty Reserved, Range Start (first ever), Range End (latest), Last Activity Date, Last Activity Type

5. Print Logs (OPS_HEAD + SM)
Columns: Batch ID, Series, Qty, Range Start, Range End, Printed By, Printed On, Linked PR

6. Payment Reports (FINANCE + OPS_HEAD)
Columns: Invoice ID, PO ID, Vendor, Invoice Amount, Match Status, Payment Status, Method, Transaction Ref, Paid By, Paid Date

Each report:
- Renders as a paginated DataTable (25 rows per page)
- "Export CSV" button top right — downloads full result set as CSV (not just current page)
- Date range filter always present
- Loading state during data fetch

SERVER ACTIONS at /app/actions/reports.ts:
- getPRHistory(filters, userId, role)
- getPOHistory(filters, role)
- getVendorPurchaseSummary(filters)
- getSerialUsageSummary()
- getPrintLogs(filters)
- getPaymentReport(filters)
- exportReportCSV(reportType, filters, role) — returns CSV string for download
```

---

## PHASE 8 — POLISH & HARDENING

### Prompt 8.1 — Error Handling, Loading States & Empty States

```
Audit and harden every screen in the KNOT Procurement system for production readiness.

Go through each page and implement the following consistently:

1. LOADING STATES
Every data-fetching page must use Next.js loading.tsx with a skeleton loader that matches the page layout. Create skeleton components for:
- DataTable skeleton (rows of gray shimmer blocks)
- Metric card skeleton (4 side-by-side shimmer cards)
- Detail page skeleton (two-column layout shimmer)
Use shadcn Skeleton component throughout.

2. ERROR BOUNDARIES
Add error.tsx files for every route group that catches fetch errors and shows:
- A clear message: "Something went wrong loading [page name]"
- A "Try again" button that calls router.refresh()
- A "Go to Dashboard" link

3. EMPTY STATES
Ensure every list view uses the shared EmptyState component when the result set is empty. Messages:
- Vendors: "No vendors found. Add your first vendor to get started."
- Purchase Requests: "No purchase requests yet. Raise your first request."
- GRNs: "No goods receipts recorded."
- Invoices: "No invoices uploaded."
- Payments: "No payment records."
- Serial Governance tabs: "No reservations recorded for this series yet."

4. FORM VALIDATION
Audit every form for:
- All required fields show clear error messages on blur and on submit attempt
- Numeric fields reject non-numeric input
- File uploads validate type (PDF/image only) and size (max 5MB) before upload
- All mandatory-at-decision-point fields (revision comment, edit reason, exception note) cannot be bypassed — server action must also validate these, not just the client form

5. TOAST NOTIFICATIONS
Add sonner (npm install sonner) for toast notifications. Show:
- Success toast on: PR submitted, PR approved, GRN recorded, Invoice uploaded, Payment updated, Vendor saved, Serial range reserved
- Error toast on: any server action failure
- Warning toast on: invoice mismatch detected, vendor change flag triggered

6. OPTIMISTIC UPDATES
For status badge updates in list views (PR approval, GRN exception resolution): use optimistic UI so the badge updates immediately without waiting for a refetch.
```

---

### Prompt 8.2 — Auth Guards, Role Gates & Final QA

```
Implement final security hardening and QA checks for the KNOT Procurement system.

1. ROUTE-LEVEL ROLE GUARDS
Add checkRole() calls to every page.tsx server component. Reference this access matrix:
  /dashboard → all roles
  /vendors → SM (read-only), OPS_HEAD (full)
  /vendors/new → OPS_HEAD only
  /vendors/[id]/edit → OPS_HEAD only
  /purchase-requests → SM, OPS_HEAD
  /purchase-requests/new → SM, OPS_HEAD
  /purchase-orders → SM (read-only), OPS_HEAD (full), FINANCE (read-only limited)
  /goods-receipt → SM, OPS_HEAD
  /invoices → SM (upload only), OPS_HEAD, FINANCE
  /payments → OPS_HEAD (read-only), FINANCE (full)
  /serial-governance → SM (view + print), OPS_HEAD (full)
  /reports → role-specific (enforced at data layer)
Any mismatch: redirect to /unauthorized

2. SERVER ACTION GUARDS
Every server action must independently verify role from the session — never trust the client:
  createVendor, updateVendor, deactivateVendor, mergeVendors → OPS_HEAD only
  approvePR, rejectPR, sendForRevision → OPS_HEAD only
  createPR, submitPR, resubmitPR → SM or OPS_HEAD
  createGRN → SM or OPS_HEAD
  createInvoice → SM or OPS_HEAD
  updatePayment → FINANCE only
  overrideInvoiceMatch → OPS_HEAD only
  resolveGRNException → OPS_HEAD only
  updateSeriesConfig → OPS_HEAD only
  reserveSerialRange → SM or OPS_HEAD
Add a validateRole(allowedRoles) guard at the top of each action that throws an error if the session role is not in allowedRoles.

3. SENSITIVE DATA MASKING AUDIT
Confirm these masking rules are enforced everywhere:
  Vendor account number: show ••••[last4] everywhere EXCEPT: never shown in full anywhere
  Vendor IFSC: shown only on Payments screen for FINANCE role
  VendorChangeLog account number entries: show ••••[last4] in old/new value

4. IDEMPOTENCY AUDIT
Confirm the serial reservation idempotencyKey is:
  Generated client-side using crypto.randomUUID() before the form submission
  Stored in form state and passed with the server action call
  Checked server-side before any reservation write

5. FINAL QA CHECKLIST — work through this and fix any failures:
  □ Login → redirects to dashboard based on role ✓
  □ SM cannot see Vendors edit, Payments screen, Serial Governance config ✓
  □ FINANCE cannot see PRs, GRNs, Serial Governance ✓
  □ Vendor Tier 1 duplicate — hard block works, no override possible ✓
  □ Vendor Tier 2 fuzzy — warning shows, save blocked without checkbox + reason ✓
  □ PR revision cycle — 3rd rejection triggers FORCE_CANCELLED ✓
  □ PR vendor request — PR cannot be submitted while vendor request is PENDING ✓
  □ GRN accepted + disputed qty always sums to received qty ✓
  □ Invoice match gate — MISMATCH invoices block payment button ✓
  □ PO auto-close — evaluates correctly on GRN + invoice + payment events ✓
  □ Serial reservation — concurrent requests do not produce overlapping ranges ✓
  □ Print idempotency — double-tap on Confirm Print does not create two reservations ✓
  □ Finance dashboard forward metrics are populated correctly ✓
  □ Vendor change flag appears on Payments screen when vendor was updated after PO creation ✓
  □ Edit History tab on Vendor detail shows field-level changes with masked account number ✓
  □ Serial number search on Range History tab returns correct reservation ✓
```

---

## REFERENCE — PHASE DEPENDENCY MAP

```
Phase 0 (Scaffold + DB) — must be complete before anything else
  └── Phase 1 (Vendors) — can start immediately after Phase 0
  └── Phase 2 (Purchase Requests) — depends on Phase 1 (vendor dropdown)
      └── Phase 3 (POs + GRN) — depends on Phase 2 (PR → PO flow)
          └── Phase 4 (Invoices + Payments) — depends on Phase 3 (GRN → Invoice)
              └── Phase 5 (Serial Governance) — depends on Phase 2 (Print PR flow)
                  └── Phase 6 (Dashboards) — depends on all prior phases
                      └── Phase 7 (Reports) — depends on all prior phases
                          └── Phase 8 (Polish + Hardening) — final pass on everything
```

---

## REFERENCE — KEY BUSINESS RULES (paste into any prompt when debugging)

```
1. This system is a CREATION AND GOVERNANCE LEDGER only. It does not track physical stock,
   WMS inventory, or consumption. It records what serial ranges were created and what
   needs to be created. It has no connection to WMS.

2. Serial ranges are reserved atomically using Serializable transaction isolation.
   No two reservations may overlap for the same series. Idempotency key prevents duplicates.

3. System determines execution type from subcategory — user never selects it.
   LOCK_TAGS subcategory → VENDOR_PURCHASE
   JEWELLERY_BARCODES / APPAREL_BARCODES subcategories → INTERNAL_PRINT

4. Internal Print flow has NO approval, NO vendor, NO invoice, NO payment.
   PR → Confirm → Atomic Reservation → Print Execution. Done.

5. Vendor Purchase flow: PR → Approval (up to 3 revision cycles) → PO → GRN → Invoice → Payment → Auto-close.

6. PO auto-close evaluates 4 conditions on every GRN, invoice, and payment event.
   All 4 must be true for CLOSED. Short-shipment accepted = PARTIALLY_CLOSED.

7. 3-way match: PO unit price × accepted GRN qty × invoice amount.
   Tolerance: ±2.5% default. Mismatch blocks payment until OPS_HEAD override.

8. Vendor creation and activation are separate. SM can request a vendor.
   OPS_HEAD activates. PR linked to a PENDING vendor request cannot be submitted.

9. PR revision cap: 3 cycles maximum. Third rejection → FORCE_CANCELLED.
   SM must raise a new PR. Original PR ID preserved in history.

10. Finance role: forward-looking dashboard, payment write access only.
    Cannot see PRs, GRNs, Serial Governance. IFSC visible on Payments screen only.
```
