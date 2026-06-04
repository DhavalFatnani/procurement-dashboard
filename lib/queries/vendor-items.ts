import "server-only";

import { prisma } from "@/lib/prisma";
import { cachedQuery, LIST_CACHE_TAGS } from "@/lib/list-cache";

export type VendorItemComparisonRow = {
  vendorId: string;
  vendorName: string;
  latestPrice: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  quoteCount: number;
  lastRecordedAt: string | null;
  lastPoId: string | null;
};

export async function getVendorComparisonForCatalogItem(
  catalogItemId: string,
): Promise<VendorItemComparisonRow[]> {
  return cachedQuery(
    "vendor-item-comparison",
    [catalogItemId],
    () => fetchVendorComparisonForCatalogItem(catalogItemId),
    { tags: [LIST_CACHE_TAGS.vendorItems, `${LIST_CACHE_TAGS.vendorItems}:${catalogItemId}`] },
  );
}

async function fetchVendorComparisonForCatalogItem(
  catalogItemId: string,
): Promise<VendorItemComparisonRow[]> {
  const links = await prisma.catalogItemVendor.findMany({
    where: { catalogItemId },
    select: {
      vendorId: true,
      vendor: { select: { businessName: true } },
    },
    orderBy: { vendor: { businessName: "asc" } },
  });

  if (links.length === 0) {
    return [];
  }

  const vendorIds = links.map((l) => l.vendorId);
  const prices = await prisma.vendorCatalogItemPrice.findMany({
    where: { catalogItemId, vendorId: { in: vendorIds } },
    orderBy: { recordedAt: "desc" },
    select: {
      vendorId: true,
      unitPrice: true,
      recordedAt: true,
      poId: true,
    },
  });

  const byVendor = new Map<
    string,
    { latest: (typeof prices)[0] | null; all: typeof prices }
  >();
  for (const vendorId of vendorIds) {
    const vendorPrices = prices.filter((p) => p.vendorId === vendorId);
    byVendor.set(vendorId, {
      latest: vendorPrices[0] ?? null,
      all: vendorPrices,
    });
  }

  return links.map((link) => {
    const stats = byVendor.get(link.vendorId);
    const all = stats?.all ?? [];
    const numeric = all.map((p) => Number(p.unitPrice)).filter(Number.isFinite);
    const min = numeric.length ? Math.min(...numeric) : null;
    const max = numeric.length ? Math.max(...numeric) : null;
    const latest = stats?.latest ?? null;

    return {
      vendorId: link.vendorId,
      vendorName: link.vendor.businessName,
      latestPrice: latest ? latest.unitPrice.toString() : null,
      minPrice: min != null ? String(min) : null,
      maxPrice: max != null ? String(max) : null,
      quoteCount: all.length,
      lastRecordedAt: latest ? latest.recordedAt.toISOString() : null,
      lastPoId: latest?.poId ?? null,
    };
  });
}
