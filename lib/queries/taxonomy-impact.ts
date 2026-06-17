import "server-only";

import {
  CatalogItemStatus,
  PRStatus,
  TaxonomyStatus,
} from "@/lib/prisma-enums";
import { prisma } from "@/lib/prisma";

export const OPEN_PR_STATUSES: PRStatus[] = [
  PRStatus.DRAFT,
  PRStatus.PENDING_APPROVAL,
  PRStatus.APPROVED,
  PRStatus.REVISION_REQUIRED,
];

export type TaxonomyBlocker = {
  code: string;
  message: string;
  ids?: string[];
};

export type TaxonomyImpact = {
  openPurchaseRequests: number;
  openPurchaseRequestIds: string[];
  purchaseRequestLines: number;
  catalogItems: {
    active: number;
    pending: number;
    inactive: number;
    rejected: number;
  };
  serialReservations: number;
  linkedSeries: string | null;
  blockers: TaxonomyBlocker[];
};

async function openPrIdsForCategory(categoryId: string): Promise<string[]> {
  const rows = await prisma.purchaseRequest.findMany({
    where: {
      status: { in: OPEN_PR_STATUSES },
      OR: [{ categoryId }, { lines: { some: { categoryId } } }],
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
  return rows.map((r) => r.id);
}

async function openPrIdsForSubcategory(subcategoryId: string): Promise<string[]> {
  const rows = await prisma.purchaseRequest.findMany({
    where: {
      status: { in: OPEN_PR_STATUSES },
      OR: [{ subcategoryId }, { lines: { some: { subcategoryId } } }],
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
  return rows.map((r) => r.id);
}

async function openPrIdsForCatalogItem(catalogItemId: string): Promise<string[]> {
  const rows = await prisma.purchaseRequest.findMany({
    where: {
      status: { in: OPEN_PR_STATUSES },
      lines: { some: { items: { some: { catalogItemId } } } },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
  return rows.map((r) => r.id);
}

function catalogItemCounts(
  rows: { status: CatalogItemStatus }[],
): TaxonomyImpact["catalogItems"] {
  const counts = { active: 0, pending: 0, inactive: 0, rejected: 0 };
  for (const row of rows) {
    switch (row.status) {
      case CatalogItemStatus.ACTIVE:
        counts.active += 1;
        break;
      case CatalogItemStatus.PENDING_APPROVAL:
        counts.pending += 1;
        break;
      case CatalogItemStatus.INACTIVE:
        counts.inactive += 1;
        break;
      case CatalogItemStatus.REJECTED:
        counts.rejected += 1;
        break;
    }
  }
  return counts;
}

export async function getCategoryImpact(categoryId: string): Promise<TaxonomyImpact | null> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      status: true,
      _count: { select: { purchaseRequestLines: true } },
      subcategories: {
        select: {
          id: true,
          status: true,
          catalogItems: { select: { status: true } },
        },
      },
    },
  });
  if (!category) return null;

  const [openPrIds, serialReservations] = await Promise.all([
    openPrIdsForCategory(categoryId),
    prisma.serialReservation.count({
      where: {
        pr: {
          OR: [
            { categoryId },
            { lines: { some: { categoryId } } },
            { subcategory: { categoryId } },
          ],
        },
      },
    }),
  ]);

  const activeSubcategoryIds = category.subcategories
    .filter((s) => s.status === TaxonomyStatus.ACTIVE)
    .map((s) => s.id);
  const catalogRows = category.subcategories.flatMap((s) => s.catalogItems);
  const blockers: TaxonomyBlocker[] = [];
  if (category.status === TaxonomyStatus.ACTIVE && activeSubcategoryIds.length > 0) {
    blockers.push({
      code: "ACTIVE_SUBCATEGORIES",
      message: "Deactivate all subcategories in this category first.",
      ids: activeSubcategoryIds,
    });
  }
  if (openPrIds.length > 0) {
    blockers.push({
      code: "OPEN_PURCHASE_REQUESTS",
      message: "Category is referenced by open purchase requests.",
      ids: openPrIds,
    });
  }
  if (category._count.purchaseRequestLines > 0) {
    blockers.push({
      code: "PR_LINE_HISTORY",
      message: "Billing granularity cannot change after purchase requests reference this category.",
    });
  }

  return {
    openPurchaseRequests: openPrIds.length,
    openPurchaseRequestIds: openPrIds,
    purchaseRequestLines: category._count.purchaseRequestLines,
    catalogItems: catalogItemCounts(catalogRows),
    serialReservations,
    linkedSeries: null,
    blockers,
  };
}

export async function getSubcategoryImpact(
  subcategoryId: string,
): Promise<TaxonomyImpact | null> {
  const subcategory = await prisma.subcategory.findUnique({
    where: { id: subcategoryId },
    select: {
      id: true,
      status: true,
      series: true,
      executionType: true,
      category: { select: { status: true } },
      catalogItems: { select: { status: true } },
      _count: { select: { purchaseRequestLines: true } },
    },
  });
  if (!subcategory) return null;

  const [openPrIds, serialReservations] = await Promise.all([
    openPrIdsForSubcategory(subcategoryId),
    prisma.serialReservation.count({
      where: {
        pr: {
          OR: [
            { subcategoryId },
            { lines: { some: { subcategoryId } } },
          ],
        },
      },
    }),
  ]);

  const activeCatalogIds = await prisma.catalogItem.findMany({
    where: {
      subcategoryId,
      status: { not: CatalogItemStatus.INACTIVE },
    },
    select: { id: true },
    take: 25,
  });

  const blockers: TaxonomyBlocker[] = [];
  if (subcategory.category.status === TaxonomyStatus.INACTIVE) {
    blockers.push({
      code: "INACTIVE_PARENT_CATEGORY",
      message: "Reactivate the parent category first.",
    });
  }
  if (subcategory.status === TaxonomyStatus.ACTIVE && activeCatalogIds.length > 0) {
    blockers.push({
      code: "ACTIVE_CATALOG_ITEMS",
      message: "Deactivate catalog items under this subcategory first.",
      ids: activeCatalogIds.map((c) => c.id),
    });
  }
  if (openPrIds.length > 0) {
    blockers.push({
      code: "OPEN_PURCHASE_REQUESTS",
      message: "Subcategory is referenced by open purchase requests.",
      ids: openPrIds,
    });
  }
  if (subcategory._count.purchaseRequestLines > 0 || serialReservations > 0) {
    blockers.push({
      code: "PROCUREMENT_HISTORY",
      message: "Execution type and series cannot change after purchase or serial use.",
    });
  }

  return {
    openPurchaseRequests: openPrIds.length,
    openPurchaseRequestIds: openPrIds,
    purchaseRequestLines: subcategory._count.purchaseRequestLines,
    catalogItems: catalogItemCounts(subcategory.catalogItems),
    serialReservations,
    linkedSeries: subcategory.series,
    blockers,
  };
}

export async function getCatalogItemImpact(
  catalogItemId: string,
): Promise<TaxonomyImpact | null> {
  const item = await prisma.catalogItem.findUnique({
    where: { id: catalogItemId },
    select: {
      id: true,
      status: true,
      subcategory: {
        select: {
          series: true,
          status: true,
          category: { select: { status: true } },
        },
      },
      _count: { select: { prLineItems: true } },
    },
  });
  if (!item) return null;

  const [openPrIds] = await Promise.all([openPrIdsForCatalogItem(catalogItemId)]);

  const blockers: TaxonomyBlocker[] = [];
  if (item.subcategory.category.status === TaxonomyStatus.INACTIVE) {
    blockers.push({
      code: "INACTIVE_PARENT_CATEGORY",
      message: "Parent category is inactive.",
    });
  }
  if (item.subcategory.status === TaxonomyStatus.INACTIVE) {
    blockers.push({
      code: "INACTIVE_PARENT_SUBCATEGORY",
      message: "Parent subcategory is inactive.",
    });
  }
  if (openPrIds.length > 0) {
    blockers.push({
      code: "OPEN_PURCHASE_REQUESTS",
      message: "Catalog item is referenced by open purchase requests.",
      ids: openPrIds,
    });
  }
  if (item._count.prLineItems > 0) {
    blockers.push({
      code: "PR_LINE_HISTORY",
      message: "Item has purchase history. Deactivate instead of deleting.",
    });
  }

  const statusCounts = {
    active: item.status === CatalogItemStatus.ACTIVE ? 1 : 0,
    pending: item.status === CatalogItemStatus.PENDING_APPROVAL ? 1 : 0,
    inactive: item.status === CatalogItemStatus.INACTIVE ? 1 : 0,
    rejected: item.status === CatalogItemStatus.REJECTED ? 1 : 0,
  };

  return {
    openPurchaseRequests: openPrIds.length,
    openPurchaseRequestIds: openPrIds,
    purchaseRequestLines: item._count.prLineItems,
    catalogItems: statusCounts,
    serialReservations: 0,
    linkedSeries: item.subcategory.series,
    blockers,
  };
}
