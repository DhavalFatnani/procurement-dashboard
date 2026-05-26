import type { GRNExceptionType, POStatus, Prisma } from "@prisma/client";

import { getCachedActiveVendorOptions } from "@/lib/cache";
import { formatProcurementRef } from "@/lib/display-ref";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { hasLockTagsLines, sumOrderedQty } from "@/lib/purchase-lines";

export type GRNFilters = {
  poId?: string;
  vendorId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasExceptions?: boolean;
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
  exceptions: {
    id: string;
    exceptionType: GRNExceptionType;
    exceptionQty: number;
    note: string;
    resolutionStatus: string | null;
    resolutionNote: string | null;
  }[];
};

export type POForGRNLine = {
  poLineItemId: string;
  /** @deprecated Legacy PO line id */
  poLineId?: string;
  lineNumber: number;
  lineItemNumber: number;
  label: string;
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
    exceptions: grn.exceptions.map((e) => ({
      id: e.id,
      exceptionType: e.exceptionType,
      exceptionQty: e.exceptionQty,
      note: e.note,
      resolutionStatus: e.resolutionStatus,
      resolutionNote: e.resolutionNote,
    })),
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
      goodsReceiptLineItems: { select: { acceptedQty: true } },
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
      goodsReceiptLines: { select: { acceptedQty: true } },
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
  grns: { select: { acceptedQty: true } },
} satisfies Prisma.PurchaseOrderSelect;

function mapPoToGrnOption(
  po: Prisma.PurchaseOrderGetPayload<{ select: typeof poForGrnSelect }>,
): POForGRNOption | null {
  const lineRows: POForGRNLine[] =
    po.lineItems.length > 0
      ? po.lineItems.map((line) => {
          const previouslyReceivedQty = line.goodsReceiptLineItems.reduce(
            (s, grl) => s + grl.acceptedQty,
            0,
          );
          return {
            poLineItemId: line.id,
            lineNumber: line.prLineItem.prLine.lineNumber,
            lineItemNumber: line.prLineItem.lineItemNumber,
            label: `${line.category.name} / ${line.subcategory.name} · ${line.catalogItem.name}`,
            orderedQty: line.orderedQty,
            previouslyReceivedQty,
            pendingQty: Math.max(0, line.orderedQty - previouslyReceivedQty),
          };
        })
      : po.lines.map((line) => {
          const previouslyReceivedQty = line.goodsReceiptLines.reduce(
            (s, grl) => s + grl.acceptedQty,
            0,
          );
          return {
            poLineItemId: line.id,
            poLineId: line.id,
            lineNumber: line.prLine.lineNumber,
            lineItemNumber: 1,
            label: `${line.category.name} / ${line.subcategory.name}`,
            orderedQty: line.orderedQty,
            previouslyReceivedQty,
            pendingQty: Math.max(0, line.orderedQty - previouslyReceivedQty),
          };
        });

  const orderedQty =
    lineRows.length > 0
      ? lineRows.reduce((s, l) => s + l.orderedQty, 0)
      : (po.orderedQty ?? 0);
  const previouslyReceivedQty = po.grns.reduce((s, g) => s + g.acceptedQty, 0);
  const pendingQty = Math.max(0, orderedQty - previouslyReceivedQty);
  if (pendingQty <= 0) {
    return null;
  }

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
    lines: lineRows,
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
): Promise<POForGRNOption[]> {
  const trimmed = q.trim();
  const where: Prisma.PurchaseOrderWhereInput = {
    status: { in: GRN_ELIGIBLE_STATUSES },
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

export async function getPOForGRNById(poId: string): Promise<POForGRNOption | null> {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, status: { in: GRN_ELIGIBLE_STATUSES } },
    select: poForGrnSelect,
  });
  if (!po) {
    return null;
  }
  return mapPoToGrnOption(po);
}

/** @deprecated Prefer searchPOsForGRN — loads all eligible POs. */
export async function getPOsForGRN(): Promise<POForGRNOption[]> {
  return searchPOsForGRN("", 100);
}

export async function getGRNFilterOptions() {
  const vendors = await getCachedActiveVendorOptions();
  return { vendors };
}
