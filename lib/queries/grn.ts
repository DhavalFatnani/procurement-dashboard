import type { GRNExceptionType, POStatus, Prisma } from "@/lib/prisma-client";

import { getCachedActiveVendorOptions } from "@/lib/cache";
import { formatProcurementRef } from "@/lib/display-ref";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  resolveExceptionForLegacyLine,
  resolveExceptionForLineItem,
  type GrnExceptionSnapshot,
} from "@/lib/grn-exception-lines";
import {
  pendingQtyForNextGrnReceipt,
  sumReceivedQtyOnPoLine,
  type GrnReceiptLinePending,
} from "@/lib/grn-pending-qty";
import {
  buildEffectiveLineMap,
  effectiveOrderedQtyForLegacyLine,
  effectiveOrderedQtyForLineItem,
  sumEffectiveOrderedQty,
} from "@/lib/po-line-effective";
import { hasLockTagsLines, sumOrderedQty } from "@/lib/purchase-lines";
import {
  goodsReceiptWhereFromScopeIds,
  purchaseOrderWhereFromScopeIds,
} from "@/lib/warehouse-scope";

export type GRNFilters = {
  poId?: string;
  vendorId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasExceptions?: boolean;
  scopeWarehouseIds?: string[];
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

export type GRNListRow = {
  id: string;
  poId: string;
  vendorName: string;
  receivedQty: number;
  acceptedQty: number;
  disputedQty: number;
  exceptionStatus: string;
  receivedByName: string;
  receivedAt: string;
};

export type GRNDetailLine = {
  poLineItemId: string;
  lineNumber: number;
  lineItemNumber: number;
  label: string;
  receivedQty: number;
  acceptedQty: number;
  disputedQty: number;
  exception: GrnExceptionSnapshot | null;
};

export type GRNDetail = {
  id: string;
  poId: string;
  prId: string;
  vendorName: string;
  receivedQty: number;
  acceptedQty: number;
  disputedQty: number;
  receivedByName: string;
  receivedAt: string;
  deliveryNoteRef: string | null;
  lines: GRNDetailLine[];
};

export type POForGRNLine = {
  poLineItemId: string;
  /** @deprecated Legacy PO line id */
  poLineId?: string;
  lineNumber: number;
  lineItemNumber: number;
  label: string;
  /** Original PO line ordered qty (for receipt entry display). */
  orderedQty: number;
  previouslyReceivedQty: number;
  pendingQty: number;
};

export type POForGRNOption = {
  id: string;
  label: string;
  vendorName: string;
  orderedQty: number;
  previouslyReceivedQty: number;
  pendingQty: number;
  isLockTags: boolean;
  lines: POForGRNLine[];
  serialRange: {
    series: string;
    rangeStart: string;
    rangeEnd: string;
  } | null;
};

export async function getGRNs(filters: GRNFilters): Promise<Paginated<GRNListRow>> {
  const filterKey = stableFilterKey({ ...filters });
  return cachedQuery(
    LIST_CACHE_TAGS.grn,
    [filterKey],
    () => fetchGRNs(filters),
    { tags: [LIST_CACHE_TAGS.grn] },
  );
}

async function fetchGRNs(filters: GRNFilters): Promise<Paginated<GRNListRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const clauses: Prisma.GoodsReceiptWhereInput[] = [];
  if (filters.poId) {
    clauses.push({ poId: filters.poId });
  }
  if (filters.vendorId) {
    clauses.push({ purchaseOrder: { vendorId: filters.vendorId } });
  }
  if (filters.dateFrom) {
    clauses.push({ receivedAt: { gte: new Date(filters.dateFrom) } });
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    clauses.push({ receivedAt: { lte: end } });
  }
  if (filters.hasExceptions === true) {
    clauses.push({ disputedQty: { gt: 0 } });
  } else if (filters.hasExceptions === false) {
    clauses.push({ disputedQty: 0 });
  }
  if (filters.scopeWarehouseIds !== undefined) {
    clauses.push(goodsReceiptWhereFromScopeIds(filters.scopeWarehouseIds));
  }

  const where: Prisma.GoodsReceiptWhereInput =
    clauses.length > 0 ? { AND: clauses } : {};

  const paginated = await paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount ?? false,
    count: () => prisma.goodsReceipt.count({ where }),
    findMany: ({ skip, take }) =>
      prisma.goodsReceipt.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          poId: true,
          receivedQty: true,
          acceptedQty: true,
          disputedQty: true,
          receivedAt: true,
          receivedBy: { select: { name: true } },
          purchaseOrder: {
            select: { vendor: { select: { businessName: true } } },
          },
          exceptions: { select: { resolutionStatus: true } },
        },
      }),
  });

  return {
    ...paginated,
    items: paginated.items.map((g) => ({
      id: g.id,
      poId: g.poId,
      vendorName: g.purchaseOrder.vendor.businessName,
      receivedQty: g.receivedQty,
      acceptedQty: g.acceptedQty,
      disputedQty: g.disputedQty,
      exceptionStatus:
        g.disputedQty > 0
          ? g.exceptions.some((e) => e.resolutionStatus == null)
            ? "Open"
            : "Resolved"
          : "None",
      receivedByName: g.receivedBy.name,
      receivedAt: g.receivedAt.toISOString(),
    })),
  };
}

export async function getGRNById(id: string): Promise<GRNDetail | null> {
  const grn = await prisma.goodsReceipt.findUnique({
    where: { id },
    include: {
      receivedBy: { select: { name: true } },
      exceptions: true,
      lineItems: {
        orderBy: [
          { purchaseOrderLineItem: { prLineItem: { prLine: { lineNumber: "asc" } } } },
          { purchaseOrderLineItem: { prLineItem: { lineItemNumber: "asc" } } },
        ],
        include: {
          purchaseOrderLineItem: {
            select: {
              category: { select: { name: true } },
              subcategory: { select: { name: true } },
              catalogItem: { select: { name: true } },
              prLineItem: {
                select: { lineItemNumber: true, prLine: { select: { lineNumber: true } } },
              },
            },
          },
        },
      },
      lines: {
        orderBy: { purchaseOrderLine: { prLine: { lineNumber: "asc" } } },
        include: {
          purchaseOrderLine: {
            select: {
              category: { select: { name: true } },
              subcategory: { select: { name: true } },
              prLine: { select: { lineNumber: true } },
            },
          },
        },
      },
      purchaseOrder: {
        select: {
          prId: true,
          vendor: { select: { businessName: true } },
        },
      },
    },
  });

  if (!grn) {
    return null;
  }

  const detailLines: GRNDetailLine[] =
    grn.lineItems.length > 0
      ? grn.lineItems.map((line) => {
          const poLine = line.purchaseOrderLineItem;
          return {
            poLineItemId: line.poLineItemId,
            lineNumber: poLine.prLineItem?.prLine.lineNumber ?? 0,
            lineItemNumber: poLine.prLineItem?.lineItemNumber ?? 0,
            label: `${poLine.category.name} / ${poLine.subcategory.name} · ${poLine.catalogItem.name}`,
            receivedQty: line.receivedQty,
            acceptedQty: line.acceptedQty,
            disputedQty: line.disputedQty,
            exception: resolveExceptionForLineItem(
              grn.exceptions,
              line.poLineItemId,
              line.disputedQty,
            ),
          };
        })
      : grn.lines.map((line) => {
          const poLine = line.purchaseOrderLine;
          return {
            poLineItemId: line.poLineId,
            lineNumber: poLine.prLine.lineNumber,
            lineItemNumber: 1,
            label: `${poLine.category.name} / ${poLine.subcategory.name}`,
            receivedQty: line.receivedQty,
            acceptedQty: line.acceptedQty,
            disputedQty: line.disputedQty,
            exception: resolveExceptionForLegacyLine(
              grn.exceptions,
              line.poLineId,
              line.disputedQty,
            ),
          };
        });

  return {
    id: grn.id,
    poId: grn.poId,
    prId: grn.purchaseOrder.prId,
    vendorName: grn.purchaseOrder.vendor.businessName,
    receivedQty: grn.receivedQty,
    acceptedQty: grn.acceptedQty,
    disputedQty: grn.disputedQty,
    receivedByName: grn.receivedBy.name,
    receivedAt: grn.receivedAt.toISOString(),
    deliveryNoteRef: grn.deliveryNoteRef,
    lines: detailLines,
  };
}

const GRN_ELIGIBLE_STATUSES: POStatus[] = ["OPEN", "PARTIALLY_RECEIVED"];

const poForGrnSelect = {
  id: true,
  orderedQty: true,
  vendor: { select: { businessName: true } },
  lineItems: {
    orderBy: [{ categoryId: "asc" }, { subcategoryId: "asc" }],
    select: {
      id: true,
      orderedQty: true,
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      catalogItem: { select: { name: true } },
      prLineItem: {
        select: { lineItemNumber: true, prLine: { select: { lineNumber: true } } },
      },
      goodsReceiptLineItems: { select: { receivedQty: true, acceptedQty: true } },
    },
  },
  lines: {
    orderBy: { prLine: { lineNumber: "asc" } },
    select: {
      id: true,
      orderedQty: true,
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      prLine: { select: { lineNumber: true } },
      goodsReceiptLines: { select: { receivedQty: true, acceptedQty: true } },
    },
  },
  purchaseRequest: {
    select: {
      category: { select: { name: true } },
    },
  },
  serialReservation: {
    select: { series: true, rangeStart: true, rangeEnd: true },
  },
  lineAdjustments: {
    orderBy: { createdAt: "asc" },
    select: {
      poLineItemId: true,
      poLineId: true,
      originalOrderedQty: true,
      effectiveOrderedQty: true,
      originalUnitPrice: true,
      effectiveUnitPrice: true,
      createdAt: true,
    },
  },
} satisfies Prisma.PurchaseOrderSelect;

export function grnReceiptQuantitiesForPoLine(
  effectiveOrderedQty: number,
  receipts: ReadonlyArray<{ receivedQty: number }>,
): GrnReceiptLinePending {
  const previouslyReceivedQty = sumReceivedQtyOnPoLine(receipts);
  return {
    previouslyReceivedQty,
    pendingQty: pendingQtyForNextGrnReceipt(effectiveOrderedQty, previouslyReceivedQty),
  };
}

function mapPoToGrnOption(
  po: Prisma.PurchaseOrderGetPayload<{ select: typeof poForGrnSelect }>,
): POForGRNOption | null {
  const effectiveMap = buildEffectiveLineMap(po.lineAdjustments);

  const lineRows: POForGRNLine[] =
    po.lineItems.length > 0
      ? po.lineItems.map((line) => {
          const effectiveOrdered = effectiveOrderedQtyForLineItem(
            line.id,
            line.orderedQty,
            effectiveMap,
          );
          const qty = grnReceiptQuantitiesForPoLine(
            effectiveOrdered,
            line.goodsReceiptLineItems,
          );
          return {
            poLineItemId: line.id,
            lineNumber: line.prLineItem?.prLine.lineNumber ?? 0,
            lineItemNumber: line.prLineItem?.lineItemNumber ?? 0,
            label: `${line.category.name} / ${line.subcategory.name} · ${line.catalogItem.name}`,
            orderedQty: line.orderedQty,
            ...qty,
          };
        })
      : po.lines.map((line) => {
          const effectiveOrdered = effectiveOrderedQtyForLegacyLine(
            line.id,
            line.orderedQty,
            effectiveMap,
          );
          const qty = grnReceiptQuantitiesForPoLine(
            effectiveOrdered,
            line.goodsReceiptLines,
          );
          return {
            poLineItemId: line.id,
            poLineId: line.id,
            lineNumber: line.prLine.lineNumber,
            lineItemNumber: 1,
            label: `${line.category.name} / ${line.subcategory.name}`,
            orderedQty: line.orderedQty,
            ...qty,
          };
        });

  const orderedQty = sumEffectiveOrderedQty(
    po.lineItems,
    po.lines,
    effectiveMap,
    po.orderedQty,
  );
  const previouslyReceivedQty = lineRows.reduce(
    (s, l) => s + l.previouslyReceivedQty,
    0,
  );
  const pendingQty = lineRows.reduce((s, l) => s + l.pendingQty, 0);
  if (pendingQty <= 0) {
    return null;
  }

  const receivableLines = lineRows.filter((line) => line.pendingQty > 0);

  const isLockTags =
    lineRows.length > 0
      ? hasLockTagsLines(
          (po.lineItems.length > 0 ? po.lineItems : po.lines).map((l) => ({
            categoryName: l.category.name,
          })),
        )
      : po.purchaseRequest.category?.name === "Lock Tags";

  return {
    id: po.id,
    label: `${formatProcurementRef(po.id)} · ${po.vendor.businessName}`,
    vendorName: po.vendor.businessName,
    orderedQty,
    previouslyReceivedQty,
    pendingQty,
    isLockTags,
    lines: receivableLines,
    serialRange:
      isLockTags && po.serialReservation
        ? {
            series: po.serialReservation.series,
            rangeStart: po.serialReservation.rangeStart.toString(),
            rangeEnd: po.serialReservation.rangeEnd.toString(),
          }
        : null,
  };
}

export async function searchPOsForGRN(
  q: string,
  limit = 20,
  scopeWarehouseIds?: string[],
): Promise<POForGRNOption[]> {
  const trimmed = q.trim();
  const where: Prisma.PurchaseOrderWhereInput = {
    status: { in: GRN_ELIGIBLE_STATUSES },
    ...(scopeWarehouseIds !== undefined
      ? purchaseOrderWhereFromScopeIds(scopeWarehouseIds)
      : {}),
  };
  if (trimmed) {
    where.OR = [
      { id: { contains: trimmed, mode: "insensitive" } },
      { vendor: { businessName: { contains: trimmed, mode: "insensitive" } } },
    ];
  }

  const pos = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: poForGrnSelect,
  });

  return pos
    .map((po) => mapPoToGrnOption(po))
    .filter((p): p is POForGRNOption => p != null);
}

export async function getPOForGRNById(
  poId: string,
  scopeWarehouseIds?: string[],
): Promise<POForGRNOption | null> {
  // Scope is part of the key: it gates which PO a user may see, so results must
  // not be shared across warehouse scopes.
  const scopeKey = scopeWarehouseIds === undefined ? "*" : scopeWarehouseIds.slice().sort().join(",");
  return cachedQuery(
    "po-for-grn",
    [poId, scopeKey],
    () => computePOForGRNById(poId, scopeWarehouseIds),
    {
      revalidate: 60,
      tags: [LIST_CACHE_TAGS.poDetail, `${LIST_CACHE_TAGS.poDetail}:${poId}`],
    },
  );
}

async function computePOForGRNById(
  poId: string,
  scopeWarehouseIds?: string[],
): Promise<POForGRNOption | null> {
  const po = await prisma.purchaseOrder.findFirst({
    where: {
      id: poId,
      status: { in: GRN_ELIGIBLE_STATUSES },
      ...(scopeWarehouseIds !== undefined
        ? purchaseOrderWhereFromScopeIds(scopeWarehouseIds)
        : {}),
    },
    select: poForGrnSelect,
  });
  if (!po) {
    return null;
  }
  return mapPoToGrnOption(po);
}

/**
 * PO options for the GRN-create combobox. Needs `pendingQty` (computed from
 * quantities) so it can't be trimmed to id/label, but it's cached per scope and
 * invalidated by GRN/PO mutations so repeat opens are instant.
 */
export async function getPOsForGRN(scopeWarehouseIds?: string[]): Promise<POForGRNOption[]> {
  const scopeKey =
    scopeWarehouseIds === undefined ? "*" : scopeWarehouseIds.slice().sort().join(",");
  return cachedQuery(
    "pos-for-grn",
    [scopeKey],
    () => searchPOsForGRN("", 100, scopeWarehouseIds),
    { revalidate: 60, tags: [LIST_CACHE_TAGS.grn, LIST_CACHE_TAGS.purchaseOrders] },
  );
}

export async function getGRNFilterOptions() {
  const vendors = await getCachedActiveVendorOptions();
  return { vendors };
}
