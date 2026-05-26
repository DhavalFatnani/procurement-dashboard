# KNOT Procurement — App flow (current implementation)

Team reference for how the dashboard works today: routes, roles, status machines, and case-wise flows.  
**Source of truth in code:** `app/`, `app/actions/`, `lib/prStatus.ts`, `lib/poAutoClose.ts`, `lib/navigation.ts`.

---

## Principles

1. **Ledger only** — Records PR/PO/GRN/invoice/payment and serial ranges. Not WMS stock or consumption.
2. **Execution type is system-driven** — Set on subcategory (`VENDOR_PURCHASE` vs `INTERNAL_PRINT`). The user does not choose it.
3. **PO status is mostly derived** — Recomputed on GRN, invoice, and payment events via `evaluatePOClosure`.
4. **Approve then fulfill** — `approvePR` sets `APPROVED` (and activates proposed catalog items); Ops configures vendor, **per catalog-item unit prices** (manual grid or CSV), and expected delivery via `createPOFromPR`. One PO is created per PR with `PurchaseOrderLineItem` rows.

---

## Entry and authentication

| Step | Detail |
|------|--------|
| Public routes | `/login`, `/login/forgot-password`, `/unauthorized` |
| Session | Supabase auth (`middleware.ts`) |
| Role | `user_metadata.role`: `SM` \| `OPS_HEAD` \| `FINANCE` |
| Warehouse | Loaded from Prisma `User` for `SM` only |
| Page guard | `lib/route-access.ts` + layout `assertRole` |
| Mutations | `requireRoles` in server actions |

After sign-in → `/dashboard` → nav from `getNavItemsForRole(role)`.

---

## Roles and navigation

| Area | SM | OPS_HEAD | FINANCE |
|------|:--:|:--------:|:-------:|
| Dashboard | ✓ | ✓ | ✓ |
| Vendors | read-only | full | — |
| Purchase requests | create / own | full + approve | — |
| Purchase orders | read-only | full | read-only (limited columns) |
| Goods receipt | create | create + resolve exceptions | — |
| Invoices | upload (own in list) | full | view |
| Payments | — | view only | record |
| Serial governance | ✓ | ✓ | — |
| Reports | limited | full | payment-focused |
| Admin → Item catalog | — | master list | — |

---

## Fork: two execution types

Subcategory `executionType` (from seed / catalog) splits the product into two paths:

| Pattern (examples) | `executionType` | Path |
|--------------------|-----------------|------|
| Lock tags (`LOCK_TAGS`) | `VENDOR_PURCHASE` | PR → approval → PO → GRN → invoice → payment |
| Jewellery / apparel barcodes | `INTERNAL_PRINT` | PR → serial reserve → print (no PO chain) |

**Case picker**

| If you are… | Go to case |
|-------------|------------|
| Buying from a vendor | [Case 1 — Vendor happy path](#case-1--vendor-purchase-happy-path) |
| Printing barcodes in-house | [Case 2 — Internal print](#case-2--internal-print) |
| Ops sent the PR back | [Case 3 — Revision loop](#case-3--revision-loop) |
| New supplier on the PR | [Case 4 — Vendor request on PR](#case-4--vendor-request-on-pr) |
| Recording goods arrival | [Case 1](#case-1--vendor-purchase-happy-path) → GRN |
| Recording supplier invoice | [Case 1](#case-1--vendor-purchase-happy-path) → Invoice |
| Closing the PO | [Case 5 — PO lifecycle](#case-5--po-lifecycle-and-auto-close) |

---

## Case 1 — Vendor purchase (happy path)

**Actors:** SM → OPS_HEAD → SM → FINANCE

| # | Who | Route / action | Result |
|---|-----|----------------|--------|
| 1 | SM | `/purchase-requests/new` → `createPR` — **Packaging / Lock Tags:** subcategory + qty; **Warehouse Maintenance:** catalog items (or propose new names) | `DRAFT` with lines (+ line items where applicable) |
| 2 | SM | `submitPR` | `PENDING_APPROVAL` + PRVersion |
| 3 | OPS | `approvePR` (review pending catalog proposals) | `APPROVED`; proposed items → `ACTIVE` catalog |
| 4 | OPS | `/purchase-orders` → `createPOFromPR` (rates grid or CSV) | PO `OPEN` with `PurchaseOrderLineItem` prices; PR `CONVERTED_TO_PO` |
| 5 | SM | `/goods-receipt/new` → `createGRN` (qty per PO line item) | `GoodsReceiptLineItem` rows; PO status via `evaluatePOClosure` |
| 6 | SM | `/invoices/new` → `createInvoice` | 3-way match vs Σ(accepted qty × item unit price) |
| 7 | FIN | `/payments` → `updatePayment` | Invoice paid (if match allows) |
| 8 | System | `evaluatePOClosure` | PO may reach `CLOSED` when all checks pass |

**Screen checklist:** `/purchase-requests` · `/purchase-requests/new` · `/purchase-requests/[id]` · `/purchase-orders` · `/purchase-orders/[id]` · `/goods-receipt/new` · `/invoices/new` · `/payments`

### PR status machine (vendor path)

Enforced in `lib/prStatus.ts`.

```
DRAFT
  → PENDING_APPROVAL     submitPR
  → CANCELLED            cancelPR

PENDING_APPROVAL
  → APPROVED             approvePR
  → REJECTED             rejectPR
  → REVISION_REQUIRED    sendForRevision
  → CANCELLED            cancelPR

REVISION_REQUIRED
  → PENDING_APPROVAL     resubmitPR (revisionCount < 3)
  → FORCE_CANCELLED      resubmitPR (revisionCount ≥ 3)

APPROVED
  → CONVERTED_TO_PO      createPOFromPR
```

---

## Case 2 — Internal print

**Actors:** SM or OPS_HEAD. **No** approval, vendor, PO, GRN, invoice, or payment.

| # | Step |
|---|------|
| 1 | `/purchase-requests/new` — subcategory is `INTERNAL_PRINT` |
| 2 | Confirm Print modal |
| 3 | `reserveSerialRangeForPR` → `atomicReserveSerialRange` (serializable) |
| 4 | PR → `EXECUTED_PRINT` (`DRAFT` → `EXECUTED_PRINT` only) |
| 5 | `/purchase-requests/[id]/print` — CSV / label export |
| 6 | `/serial-governance` for range governance |

---

## Case 3 — Revision loop

| Step | Actor | Action |
|------|-------|--------|
| 1 | OPS | `sendForRevision` → `REVISION_REQUIRED`, `revisionCount++` |
| 2 | SM | Edit PR (`DRAFT` or `REVISION_REQUIRED`; own PRs only) |
| 3 | SM | `resubmitPR` → `PENDING_APPROVAL` if `revisionCount < 3` |
| 4 | SM | Fourth cycle → `FORCE_CANCELLED` |
| 5 | OPS | `forceClosePR` available on several non-terminal PR statuses |

---

## Case 4 — Vendor request on PR

| Step | Detail |
|------|--------|
| 1 | SM optional `createVendorRequest` on create PR → `PENDING`, linked via `vendorRequestId` |
| 2 | SM may `submitPR` while request is still `PENDING` (no vendor on PR yet) |
| 3 | OPS `reviewVendorRequest` on `/vendors` → vendor `ACTIVE` |
| 4 | OPS selects that vendor (or any active vendor) when `createPOFromPR` on Purchase Orders |

---

## Case 5 — PO lifecycle and auto-close

**Derived status** (unless `FORCE_CLOSED`):  
`OPEN` → `PARTIALLY_RECEIVED` → `FULLY_RECEIVED` → `INVOICED` → `PAID` → `CLOSED` or `PARTIALLY_CLOSED`

**All four must pass for `CLOSED`:**

1. Delivery complete (`deliveryComplete` or received qty ≥ ordered)
2. Invoiced within tolerance vs Σ(accepted GRN line qty × PO line unit price)
3. All invoices `PAID`
4. No open GRN exceptions (`resolutionStatus` null)

If invoiced + paid but delivery incomplete → `PARTIALLY_CLOSED`.

**OPS manual actions:** `markDeliveryComplete` · `forceClosePO` · `resolveGRNException` · `overrideInvoiceMatch` · `updatePOExpectedDelivery`

---

## Case 6 — Invoice match and payment gate

| Step | Detail |
|------|--------|
| Match | `computeInvoiceMatch`: accepted GRN qty × PO `unitPrice` vs invoice amount, default ±2.5% |
| `MATCHED` | Finance may pay |
| `MISMATCH` | `updatePayment` blocked for paid/partial until OPS `overrideInvoiceMatch` |
| Pay | `updatePayment` — FINANCE only; txn ref required when paid/partial |

---

## Case 7 — Vendor master data (parallel)

| Actor | Actions |
|-------|---------|
| OPS | `createVendor`, `updateVendor`, `deactivateVendor`, `mergeVendors`, `reviewVendorRequest` |
| SM | Read-only vendor list and detail |

Duplicate checks on phone / email / GST; similar-name warning (Jaro–Winkler) on create.

---

## Case 8 — GRN with exceptions

| Step | Detail |
|------|--------|
| Create | `createGRN` on PO in `OPEN` or `PARTIALLY_RECEIVED` |
| Qty | `receivedQty`, `acceptedQty`, `disputedQty`; cannot exceed pending on PO |
| Exception | Optional `GRNException` + note |
| Resolve | OPS `resolveGRNException` — blocks auto-close until resolved |
| After | `evaluatePOClosure` |

---

## Terminal outcomes (quick reference)

| Outcome | PR / PO | Who |
|---------|---------|-----|
| Cancelled | PR `CANCELLED` | SM / OPS (draft or pending) |
| Rejected | PR `REJECTED` | OPS |
| Revision cap | PR `FORCE_CANCELLED` | SM 4th resubmit |
| Force close PR | PR `FORCE_CANCELLED` | OPS |
| Force close PO | PO `FORCE_CLOSED` | OPS |

---

## Code map

| Concern | Location |
|---------|----------|
| PR transitions | `lib/prStatus.ts` |
| PO closure | `lib/poAutoClose.ts` |
| Invoice match | `lib/invoiceMatch.ts` |
| PR actions | `app/actions/purchase-requests.ts` |
| PO actions | `app/actions/purchase-orders.ts` |
| GRN | `app/actions/grn.ts` |
| Invoices | `app/actions/invoices.ts` |
| Payments | `app/actions/payments.ts` |
| Serial / print | `app/actions/serial.ts` |
| Vendors | `app/actions/vendors.ts` |
| Nav by role | `lib/navigation.ts` |
| Route access | `lib/route-access.ts` |

---

## Related docs

- UI/UX screens: [`knot_procurement_ui_ux.md`](./knot_procurement_ui_ux.md)
- FigJam Mermaid sources (optional diagrams): [`figjam/`](./figjam/)
