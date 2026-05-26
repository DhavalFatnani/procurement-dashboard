import { revalidatePath, revalidateTag } from "next/cache";

import { LIST_CACHE_TAGS } from "@/lib/list-cache";

/** Invalidate cached dashboard metric counts after procurement mutations. */
export function revalidateDashboardMetrics() {
  revalidateTag("dashboard-metrics");
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
  revalidatePath(`/purchase-orders/${poId}`);
  revalidateInvoicesCache();
  revalidatePaymentsCache();
  revalidatePurchaseOrdersCache(poId);
  revalidateDashboardMetrics();
}

export function revalidatePaymentMutation(poId: string) {
  revalidatePath("/payments");
  revalidatePath("/invoices");
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePaymentsCache();
  revalidateInvoicesCache();
  revalidatePurchaseOrdersCache(poId);
  revalidateDashboardMetrics();
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
