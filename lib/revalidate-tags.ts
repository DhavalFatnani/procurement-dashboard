import { revalidatePath, revalidateTag } from "next/cache";

import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { LIST_CACHE_TAGS } from "@/lib/list-cache";

const FINANCE_LIST_PATHS = [
  FINANCE_ROUTES.invoiceSettlement,
  FINANCE_ROUTES.vendorAdvances,
  FINANCE_ROUTES.paymentRegister,
] as const;

function revalidateFinanceListPaths() {
  for (const path of FINANCE_LIST_PATHS) {
    revalidatePath(path);
  }
}

/** Invalidate cached dashboard metric counts after procurement mutations. */
export function revalidateCatalogCache() {
  revalidateTag("catalog-items");
  revalidateTag(LIST_CACHE_TAGS.catalog);
  revalidatePath("/admin/catalog");
}

export function revalidateSerialGovernance() {
  revalidatePath("/serial-governance");
  revalidatePath("/serial-governance/range-map");
}

export function revalidateDashboardMetrics() {
  revalidateTag("dashboard-metrics");
  revalidateTag(LIST_CACHE_TAGS.inbox);
}

export function revalidateInboxCache() {
  revalidateTag(LIST_CACHE_TAGS.inbox);
  revalidatePath("/inbox");
}

export function revalidatePurchaseOrdersCache(poId?: string) {
  revalidateTag(LIST_CACHE_TAGS.purchaseOrders);
  revalidateTag(LIST_CACHE_TAGS.awaitingPo);
  revalidateTag(LIST_CACHE_TAGS.poDetail);
  if (poId) {
    revalidateTag(`${LIST_CACHE_TAGS.poDetail}:${poId}`);
  }
}

export function revalidatePurchaseRequestsCache(prId?: string) {
  revalidateTag(LIST_CACHE_TAGS.purchaseRequests);
  revalidateTag(LIST_CACHE_TAGS.awaitingPo);
  revalidateTag(LIST_CACHE_TAGS.prDetail);
  if (prId) {
    revalidateTag(`${LIST_CACHE_TAGS.prDetail}:${prId}`);
  }
}

export function revalidateInvoicesCache() {
  revalidateTag(LIST_CACHE_TAGS.invoices);
}

export function revalidatePaymentsCache() {
  revalidateTag(LIST_CACHE_TAGS.payments);
}

export function revalidateGRNCache() {
  revalidateTag(LIST_CACHE_TAGS.grn);
}

export function revalidatePurchaseRequestMutation(
  prId?: string,
  options?: { purchaseOrders?: boolean },
) {
  revalidatePurchaseRequestsCache(prId);
  revalidatePath("/purchase-requests");
  if (prId) {
    revalidatePath(`/purchase-requests/${prId}`);
  }
  revalidateDashboardMetrics();
  if (options?.purchaseOrders) {
    revalidatePurchaseOrdersCache();
    revalidatePath("/purchase-orders");
  }
}

/** Narrow invalidation after PR status transitions (approve / reject / submit / revision). */
export function revalidatePRStatusChange(
  prId: string,
  options?: { affectsAwaitingPo?: boolean; affectsCatalog?: boolean },
) {
  revalidateTag(`${LIST_CACHE_TAGS.prDetail}:${prId}`);
  revalidateTag(LIST_CACHE_TAGS.purchaseRequests);
  revalidateInboxCache();
  revalidatePath(`/purchase-requests/${prId}`);
  revalidatePath("/purchase-requests");
  revalidateDashboardMetrics();
  if (options?.affectsAwaitingPo) {
    revalidateTag(LIST_CACHE_TAGS.awaitingPo);
    revalidatePath("/purchase-orders");
    revalidatePath("/purchase-orders/configure");
  }
  if (options?.affectsCatalog) {
    revalidateCatalogCache();
  }
}

/** After createPOFromPR — PO list, awaiting panel, linked PR detail. */
export function revalidateCreatePOFromPR(prId: string, poId: string) {
  revalidateTag(`${LIST_CACHE_TAGS.prDetail}:${prId}`);
  revalidateTag(`${LIST_CACHE_TAGS.poDetail}:${poId}`);
  revalidateTag(LIST_CACHE_TAGS.purchaseRequests);
  revalidateTag(LIST_CACHE_TAGS.purchaseOrders);
  revalidateTag(LIST_CACHE_TAGS.awaitingPo);
  revalidateTag(LIST_CACHE_TAGS.vendorItems);
  revalidatePath(`/purchase-requests/${prId}`);
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  revalidatePath("/purchase-orders/configure");
  revalidatePath("/purchase-requests");
  revalidateInboxCache();
  revalidateDashboardMetrics();
}

/** Minimal invalidation after internal print reservation — keeps confirm-and-reserve snappy. */
export function revalidateInternalPrintMutation(prId: string) {
  revalidatePurchaseRequestsCache(prId);
  revalidatePath(`/purchase-requests/${prId}`);
  revalidatePath(`/purchase-requests/${prId}/print`);
}

export function revalidateGRNMutation(poId: string) {
  revalidatePath("/goods-receipt");
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${poId}`);
  revalidateGRNCache();
  revalidatePurchaseOrdersCache(poId);
  revalidateDashboardMetrics();
}

export function revalidateInvoiceMutation(poId: string) {
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidateFinanceListPaths();
  revalidatePath(`/purchase-orders/${poId}`);
  revalidateInvoicesCache();
  revalidatePaymentsCache();
  revalidatePurchaseOrdersCache(poId);
  revalidateDashboardMetrics();
}

export function revalidatePaymentMutation(poId: string) {
  revalidatePath("/payments");
  revalidateFinanceListPaths();
  revalidatePath("/invoices");
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePaymentsCache();
  revalidateInvoicesCache();
  revalidatePurchaseOrdersCache(poId);
  revalidateAdvanceRequestsCache();
  revalidateDashboardMetrics();
}

export function revalidateAdvanceRequestsCache() {
  revalidateTag(LIST_CACHE_TAGS.advanceRequests);
  revalidateTag(LIST_CACHE_TAGS.inbox);
  revalidatePath("/payments");
  revalidateFinanceListPaths();
}

export function revalidatePOMutation(poId: string, prId?: string) {
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePurchaseOrdersCache(poId);
  if (prId) {
    revalidatePath(`/purchase-requests/${prId}`);
    revalidatePurchaseRequestsCache(prId);
  }
  revalidateDashboardMetrics();
}

/** Broad invalidation for PR lifecycle changes that touch many lists. */
export function revalidateProcurementLists(prId?: string, poId?: string, vendorId?: string) {
  revalidateTag("filter-creators");
  revalidatePurchaseRequestsCache(prId);
  revalidatePurchaseOrdersCache(poId);
  revalidateInvoicesCache();
  revalidatePaymentsCache();
  revalidateGRNCache();
  revalidatePath("/purchase-requests");
  revalidatePath("/dashboard");
  revalidatePath("/purchase-orders");
  revalidatePath("/goods-receipt");
  revalidatePath("/invoices");
  revalidatePath("/payments");
  revalidateFinanceListPaths();
  revalidatePath("/vendors");
  if (prId) {
    revalidatePath(`/purchase-requests/${prId}`);
  }
  if (poId) {
    revalidatePath(`/purchase-orders/${poId}`);
  }
  if (vendorId) {
    revalidatePath(`/vendors/${vendorId}`);
  }
  revalidateDashboardMetrics();
}
