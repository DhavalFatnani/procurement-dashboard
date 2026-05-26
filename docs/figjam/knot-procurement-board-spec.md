# FigJam board layout — KNOT Procurement app flow

Build this board left → right. Each **Section** title matches a FigJam section name. **Stickies** are copy-paste text; place near the diagram they annotate.

---

## Section 00 — Overview

**Section subtitle:** Current implementation · case-wise flows · May 2026

### Stickies (top row)

| Sticky color | Title | Body |
|--------------|-------|------|
| Gray | Ledger only | Records PR/PO/GRN/invoice/payment and serial ranges. Not WMS stock. |
| Yellow | Two execution types | Subcategory sets VENDOR_PURCHASE vs INTERNAL_PRINT. User never picks. |
| Blue | SM | Store Manager — PR, GRN, invoice upload, internal print |
| Purple | OPS_HEAD | Approvals, vendors, PO ops, match override, GRN exceptions |
| Green | FINANCE | Payments, invoice view, limited PO/reports |

### Diagram

Paste [`00-case-picker.mmd`](./00-case-picker.mmd).

### Connectors to other sections

- "Vendor buying" → Section 02
- "Printing barcodes" → Section 03
- "PR sent back" → Section 05
- "New supplier on PR" → Section 08

---

## Section 01 — Entry and auth

### Stickies

| Color | Title | Body |
|-------|-------|------|
| Gray | Routes | `/login` → session → `/dashboard`. Public: login, forgot-password, unauthorized. |
| Gray | Role source | Supabase `user_metadata.role`: SM \| OPS_HEAD \| FINANCE |
| Gray | Guards | Pages: `lib/route-access.ts`. Mutations: `requireRoles` in server actions. |

### Diagram

Paste [`01-entry-auth.mmd`](./01-entry-auth.mmd).

### Nav by role (sticky grid)

**SM:** Dashboard · Vendors (RO) · PR · PO (RO) · GRN · Invoices (upload) · Serial · Reports (limited)

**OPS_HEAD:** Dashboard · Vendors · PR · PO · GRN · Invoices · Payments (view) · Serial · Reports (full)

**FINANCE:** Dashboard · PO (RO) · Invoices · Payments · Reports (payment)

---

## Section 02 — Case: Vendor purchase (happy path)

### Stickies

| Color | Title | Body |
|-------|-------|------|
| Blue | SM creates | `/purchase-requests/new` → createPR (DRAFT) → submitPR (PENDING_APPROVAL) |
| Purple | OPS approves | approvePR → APPROVED; createPOFromPR on Purchase Orders → PO OPEN, PR CONVERTED_TO_PO |
| Blue | SM receives | `/goods-receipt/new` → createGRN |
| Blue | SM invoices | `/invoices/new` → createInvoice + 3-way match |
| Green | FINANCE pays | `/payments` → updatePayment. Blocked if MISMATCH until OPS override. |
| Gray | Auto close | evaluatePOClosure after GRN / invoice / payment |

### Diagram

Paste [`02-vendor-happy-path.mmd`](./02-vendor-happy-path.mmd).

### Screen checklist (sticky column)

1. `/purchase-requests`
2. `/purchase-requests/new`
3. `/purchase-requests/[id]`
4. `/purchase-orders` + `/[id]` (reconciliation panel)
5. `/goods-receipt/new`
6. `/invoices/new`
7. `/payments`

---

## Section 03 — Case: Internal print

### Stickies

| Color | Title | Body |
|-------|-------|------|
| Yellow | No PO chain | No approval, vendor, GRN, invoice, or payment |
| Blue | Confirm print | CreatePRForm → reserveSerialRangeForPR → atomic serial reserve |
| Gray | Status | DRAFT → EXECUTED_PRINT only |
| Blue | Output | `/purchase-requests/[id]/print` — CSV / labels |

### Diagram

Paste [`03-internal-print.mmd`](./03-internal-print.mmd).

**Subcategory examples (seed):** Jewellery barcodes, Apparel barcodes → INTERNAL_PRINT. Lock tags → VENDOR_PURCHASE.

---

## Section 04 — PR status machine

### Diagram

Paste [`04-pr-status.mmd`](./04-pr-status.mmd).

### Stickies

| Color | Title | Body |
|-------|-------|------|
| Gray | Enforced in | `lib/prStatus.ts` — invalid transitions throw |
| Purple | PO fulfillment | createPOFromPR (vendor, unit price, expected delivery) after approve |
| Red tint | Terminals | REJECTED, CANCELLED, FORCE_CANCELLED, CONVERTED_TO_PO, EXECUTED_PRINT |

---

## Section 05 — Case: Revision loop

### Stickies

| Color | Title | Body |
|-------|-------|------|
| Purple | Send back | sendForRevision → REVISION_REQUIRED, revisionCount++ |
| Blue | SM fixes | Edit PR, resubmitPR (own PRs only) |
| Yellow | Cap | revisionCount >= 3 on resubmit → FORCE_CANCELLED |
| Purple | Force close PR | forceClosePR from OPS on several non-terminal statuses |

### Diagram

Paste [`05-revision-loop.mmd`](./05-revision-loop.mmd).

---

## Section 06 — PO lifecycle and auto-close

### Stickies

| Color | Title | Body |
|-------|-------|------|
| Gray | Derived status | OPEN → PARTIALLY_RECEIVED → FULLY_RECEIVED → INVOICED → PAID → CLOSED |
| Gray | Four checks for CLOSED | 1 Delivery complete · 2 Invoiced within tolerance · 3 All invoices PAID · 4 No open GRN exceptions |
| Gray | Partial close | Invoiced + paid but delivery incomplete → PARTIALLY_CLOSED |
| Purple | Manual | markDeliveryComplete, forceClosePO, resolveGRNException |

### Diagram

Paste [`06-po-lifecycle.mmd`](./06-po-lifecycle.mmd).

---

## Section 07 — Invoice match and payment gate

### Stickies

| Color | Title | Body |
|-------|-------|------|
| Gray | 3-way match | accepted GRN qty × PO unitPrice vs invoice amount, default ±2.5% |
| Yellow | MISMATCH | FINANCE cannot set PAID/PARTIAL until OPS overrideInvoiceMatch |
| Green | Payment | updatePayment — FINANCE only, txn ref required when paid |

### Diagram

Paste [`07-invoice-payment.mmd`](./07-invoice-payment.mmd).

---

## Section 08 — Case: Vendor request on PR

### Stickies

| Color | Title | Body |
|-------|-------|------|
| Blue | On create PR | createVendorRequest → PENDING, linked to PR |
| Yellow | Vendor request on PR | Optional on create PR; Ops assigns vendor at PO creation |
| Purple | Activate | reviewVendorRequest on /vendors → vendor ACTIVE, PR can proceed |

### Diagram

Paste [`08-vendor-on-pr.mmd`](./08-vendor-on-pr.mmd).

---

## Connector map (between sections)

Draw dashed FigJam connectors with these labels:

```
00 → 01  "Sign in"
00 → 02  "Vendor purchase"
00 → 03  "Internal print"
00 → 05  "Revision loop"
00 → 08  "New vendor on PR"
02 → 04  "PR statuses"
02 → 06  "After PO created"
02 → 07  "Invoice and pay"
06 → 07  "Match gates payment"
```

---

## Optional: workshop agenda sticky

**Title:** 45-min walkthrough

1. Overview + roles (5m)
2. Vendor happy path live in dev (15m)
3. Internal print + serial (10m)
4. Revision + vendor request edge cases (10m)
5. PO close + payment gate (5m)
