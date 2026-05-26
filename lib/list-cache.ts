import "server-only";

import { unstable_cache } from "next/cache";

/** Default TTL for list/detail reads — short enough to feel fresh, long enough to skip repeat round-trips. */
export const LIST_CACHE_SECONDS = 60;

/** Stable JSON key for filter objects passed to unstable_cache. */
export function stableFilterKey(filters: Record<string, unknown>): string {
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

type CachedQueryOptions = {
  revalidate?: number;
  tags: string[];
};

/** Cross-request cache for expensive list/detail Prisma reads. Invalidate via revalidateTag on mutations. */
export function cachedQuery<T>(
  namespace: string,
  keyParts: string[],
  fn: () => Promise<T>,
  options: CachedQueryOptions,
): Promise<T> {
  return unstable_cache(fn, [namespace, ...keyParts], {
    revalidate: options.revalidate ?? LIST_CACHE_SECONDS,
    tags: options.tags,
  })();
}

export const LIST_CACHE_TAGS = {
  purchaseOrders: "purchase-orders-list",
  purchaseRequests: "purchase-requests-list",
  invoices: "invoices-list",
  payments: "payments-list",
  grn: "grn-list",
  poDetail: "po-detail",
  prDetail: "pr-detail",
  catalog: "catalog-list",
  awaitingPo: "awaiting-po-list",
  inbox: "inbox",
} as const;
