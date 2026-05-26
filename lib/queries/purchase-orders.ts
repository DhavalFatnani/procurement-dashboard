import { cache } from "react";

import {
  ExecutionType,
  GRNExceptionResolution,
  InvoiceMatchStatus,
  PaymentStatus,
  POStatus,
  PRStatus,
  type Prisma,
} from "@prisma/client";

import { getCachedActiveVendorOptions, getCachedWarehouses } from "@/lib/cache";
import { dbParallel } from "@/lib/db-parallel";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import {
  aggregateInvoiceMatchStatus,
  aggregatePaymentStatus,
  buildClosureSnapshot,
  deliveryStatusLabel,
} from "@/lib/poAutoClose";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  formatLineSummary,
  hasLockTagsLines,
  sumOrderedQty,
  type POLineRow,
  type PRLineRow,
} from "@/lib/purchase-lines";

export type PurchaseOrderFilters = {
  status?: POStatus;
  vendorId?: string;
  warehouseId?: string;
  /** When set, restricts results to these assigned warehouses (from session). */
  scopeWarehouseIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

export type PurchaseOrderListRow = {
  id: string;
  prId: string;
  vendorName: string;
  warehouseName: string;
  deliveryStatus: string;
  invoiceMatchStatus: InvoiceMatchStatus;
  paymentStatus: PaymentStatus;
  poStatus: POStatus;
  expectedDelivery: string | null;
  orderedQty: number;
  receivedQty: number;
  createdAt: string;
};

export type POGRNRow = {
  id: string;
  receivedQty: number;
  acceptedQty: number;
  disputedQty: number;
  receivedByName: string;
  receivedAt: string;
  hasOpenDispute: boolean;
  exceptions: {
    id: string;
    exceptionType: string;
    exceptionQty: number;
    note: string;
    resolutionStatus: GRNExceptionResolution | null;
    resolutionNote: string | null;
  }[];
};

export type POInvoiceRow = {
  id: string;
  invoiceNumber: string;
  grnIds: string[];
  amount: string;
  expectedAmount: string | null;
  matchStatus: InvoiceMatchStatus;
  paymentStatus: PaymentStatus;
  uploadedByName: string;
  createdAt: string;
};

export type PODetail = {
  id: string;
  prId: string;
  categoryName: string;
  subcategoryName: string;
  lineSummary: string;
  isLockTags: boolean;
  orderedQty: number;
  unitPrice: string | null;
  lines: POLineRow[];
  expectedDelivery: string | null;
  deliveryComplete: boolean;
  status: POStatus;
  forceCloseReason: string | null;
  createdAt: string;
  vendor: {
    id: string;
    businessName: string;
    pocName: string;
    phone: string;
    email: string;
  };
  serialReservation: {
    series: string;
    rangeStart: string;
    rangeEnd: string;
    status: string;
  } | null;
  reconciliation: {
    ordered: number;
    received: number;
    invoiced: number;
    paid: number;
    checks: {
      id: string;
      label: string;
      done: boolean;
    }[];
  };
  grns: POGRNRow[];
  invoices: POInvoiceRow[];
};

export async function getPurchaseOrders(
  filters: PurchaseOrderFilters,
): Promise<Paginated<PurchaseOrderListRow>> {
  const filterKey = stableFilterKey({ ...filters });
  return cachedQuery(
    LIST_CACHE_TAGS.purchaseOrders,
    [filterKey],
    () => fetchPurchaseOrders(filters),
    { tags: [LIST_CACHE_TAGS.purchaseOrders] },
  );
}

async function fetchPurchaseOrders(
  filters: PurchaseOrderFilters,
): Promise<Paginated<PurchaseOrderListRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const clauses: Prisma.PurchaseOrderWhereInput[] = [];
  if (filters.status) {
    clauses.push({ status: filters.status });
  }
  if (filters.vendorId) {
    clauses.push({ vendorId: filters.vendorId });
  }
  if (filters.scopeWarehouseIds?.length) {
    const ids = filters.scopeWarehouseIds;
    clauses.push({
      purchaseRequest: {
        warehouseId: ids.length === 1 ? ids[0]! : { in: ids },
      },
    });
  } else if (filters.warehouseId) {
    clauses.push({
      purchaseRequest: { warehouseId: filters.warehouseId },
    });
  }
  if (filters.dateFrom) {
    clauses.push({ createdAt: { gte: new Date(filters.dateFrom) } });
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    clauses.push({ createdAt: { lte: end } });
  }

  const where: Prisma.PurchaseOrderWhereInput =
    clauses.length > 0 ? { AND: clauses } : {};

  const paginated = await paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount ?? false,
    count: () => prisma.purchaseOrder.count({ where }),
    findMany: ({ skip, take }) =>
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          prId: true,
          orderedQty: true,
          status: true,
          deliveryComplete: true,
          expectedDelivery: true,
          createdAt: true,
          lines: { select: { orderedQty: true } },
          vendor: { select: { businessName: true } },
          purchaseRequest: {
            select: { warehouse: { select: { name: true } } },
          },
        },
      }),
  });

  const poIds = paginated.items.map((po) => po.id);
  if (poIds.length === 0) {
    return { ...paginated, items: [] };
  }

  const [grnAgg, invoiceRows] = await dbParallel(
    () =>
      prisma.goodsReceipt.groupBy({
        by: ["poId"],
        where: { poId: { in: poIds } },
        _sum: { acceptedQty: true },
      }),
    () =>
      prisma.invoice.findMany({
        where: { poId: { in: poIds } },
        select: { poId: true, matchStatus: true, paymentStatus: true },
      }),
  );

  const receivedByPo = new Map(
    grnAgg.map((row) => [row.poId, row._sum.acceptedQty ?? 0]),
  );
  const invoicesByPo = new Map<string, { matchStatus: InvoiceMatchStatus; paymentStatus: PaymentStatus }[]>();
  for (const inv of invoiceRows) {
    const list = invoicesByPo.get(inv.poId) ?? [];
    list.push(inv);
    invoicesByPo.set(inv.poId, list);
  }

  return {
    ...paginated,
    items: paginated.items.map((po) => {
      const receivedQty = receivedByPo.get(po.id) ?? 0;
      const invoices = invoicesByPo.get(po.id) ?? [];
      const orderedQty =
        po.lines.length > 0 ? sumOrderedQty(po.lines) : (po.orderedQty ?? 0);
      return {
        id: po.id,
        prId: po.prId,
        vendorName: po.vendor.businessName,
        warehouseName: po.purchaseRequest.warehouse.name,
        deliveryStatus: deliveryStatusLabel(
          orderedQty,
          receivedQty,
          po.deliveryComplete,
        ),
        invoiceMatchStatus: aggregateInvoiceMatchStatus(invoices),
        paymentStatus: aggregatePaymentStatus(invoices),
        poStatus: po.status,
        expectedDelivery: po.expectedDelivery?.toISOString() ?? null,
        orderedQty,
        receivedQty,
        createdAt: po.createdAt.toISOString(),
      };
    }),
  };
}

export const getPOById = cache(async (id: string): Promise<PODetail | null> => {
  return cachedQuery(
    LIST_CACHE_TAGS.poDetail,
    [id],
    () => fetchPOById(id),
    { tags: [LIST_CACHE_TAGS.poDetail, `${LIST_CACHE_TAGS.poDetail}:${id}`] },
  );
});

async function fetchPOById(id: string): Promise<PODetail | null> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          pocName: true,
          phone: true,
          email: true,
        },
      },
      lines: {
        orderBy: { prLine: { lineNumber: "asc" } },
        include: {
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          prLine: { select: { lineNumber: true } },
          goodsReceiptLines: { select: { acceptedQty: true } },
        },
      },
      purchaseRequest: {
        select: {
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          lines: {
            orderBy: { lineNumber: "asc" },
            select: {
              subcategory: { select: { name: true } },
              category: { select: { name: true } },
            },
          },
        },
      },
      serialReservation: {
        select: {
          series: true,
          rangeStart: true,
          rangeEnd: true,
          status: true,
        },
      },
      grns: {
        orderBy: { receivedAt: "desc" },
        include: {
          receivedBy: { select: { name: true } },
          exceptions: true,
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { name: true } },
          grnLinks: { select: { grnId: true } },
          payments: { select: { amount: true } },
        },
      },
    },
  });

  if (!po) {
    return null;
  }

  const snapshot = buildClosureSnapshot(po);

  const closureLabels: { id: string; label: string; done: boolean }[] = [
    {
      id: "delivery",
      label: "Delivery complete",
      done: snapshot.checks.deliveryComplete,
    },
    {
      id: "invoiced",
      label: "Invoiced matches received value (within tolerance)",
      done: snapshot.checks.invoicedMatchesReceived,
    },
    {
      id: "paid",
      label: "All invoices paid",
      done: snapshot.checks.allInvoicesPaid,
    },
    {
      id: "disputes",
      label: "No open GRN disputes",
      done: snapshot.checks.noOpenDisputes,
    },
  ];

  const lineRows: POLineRow[] = po.lines.map((line) => ({
    id: line.id,
    prLineId: line.prLineId,
    lineNumber: line.prLine.lineNumber,
    categoryId: line.categoryId,
    categoryName: line.category.name,
    subcategoryId: line.subcategoryId,
    subcategoryName: line.subcategory.name,
    orderedQty: line.orderedQty,
    unitPrice: line.unitPrice.toString(),
    receivedQty: line.goodsReceiptLines.reduce((s, grl) => s + grl.acceptedQty, 0),
  }));

  const prLineSummary = formatLineSummary(
    po.purchaseRequest.lines.length > 0
      ? po.purchaseRequest.lines.map((l) => ({
          subcategoryName: l.subcategory.name,
          categoryName: l.category.name,
        }))
      : lineRows.map((l) => ({
          subcategoryName: l.subcategoryName,
          categoryName: l.categoryName,
        })),
  );

  const orderedQty = lineRows.length > 0 ? sumOrderedQty(lineRows) : (po.orderedQty ?? 0);
  const isLockTags =
    lineRows.length > 0
      ? hasLockTagsLines(lineRows)
      : po.purchaseRequest.category?.name === "Lock Tags";

  return {
    id: po.id,
    prId: po.prId,
    categoryName: lineRows[0]?.categoryName ?? po.purchaseRequest.category?.name ?? "—",
    subcategoryName: lineRows[0]?.subcategoryName ?? po.purchaseRequest.subcategory?.name ?? "—",
    lineSummary: prLineSummary.summary,
    isLockTags,
    orderedQty,
    unitPrice:
      lineRows.length === 1
        ? lineRows[0]!.unitPrice
        : (po.unitPrice?.toString() ?? null),
    lines: lineRows,
    expectedDelivery: po.expectedDelivery?.toISOString() ?? null,
    deliveryComplete: po.deliveryComplete,
    status: po.status,
    forceCloseReason: po.forceCloseReason,
    createdAt: po.createdAt.toISOString(),
    vendor: po.vendor,
    serialReservation: po.serialReservation
      ? {
          series: po.serialReservation.series,
          rangeStart: po.serialReservation.rangeStart.toString(),
          rangeEnd: po.serialReservation.rangeEnd.toString(),
          status: po.serialReservation.status,
        }
      : null,
    reconciliation: {
      ordered: snapshot.orderedQty,
      received: snapshot.receivedQty,
      invoiced: snapshot.invoicedAmount,
      paid: snapshot.paidAmount,
      checks: closureLabels,
    },
    grns: po.grns.map((g) => ({
      id: g.id,
      receivedQty: g.receivedQty,
      acceptedQty: g.acceptedQty,
      disputedQty: g.disputedQty,
      receivedByName: g.receivedBy.name,
      receivedAt: g.receivedAt.toISOString(),
      hasOpenDispute: g.disputedQty > 0 && g.exceptions.some((e) => e.resolutionStatus == null),
      exceptions: g.exceptions.map((e) => ({
        id: e.id,
        exceptionType: e.exceptionType,
        exceptionQty: e.exceptionQty,
        note: e.note,
        resolutionStatus: e.resolutionStatus,
        resolutionNote: e.resolutionNote,
      })),
    })),
    invoices: po.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      grnIds: inv.grnLinks.map((l) => l.grnId),
      amount: inv.amount.toString(),
      expectedAmount: inv.expectedAmount?.toString() ?? null,
      matchStatus: inv.matchStatus,
      paymentStatus: inv.paymentStatus,
      uploadedByName: inv.uploadedBy.name,
      createdAt: inv.createdAt.toISOString(),
    })),
  };
}

export const getPOFilterOptions = cache(async () => {
  const [vendors, warehouses] = await dbParallel(
    () => getCachedActiveVendorOptions(),
    () => getCachedWarehouses(),
  );
  return { vendors, warehouses };
});

export type ApprovedPRAwaitingPO = {
  id: string;
  categoryName: string;
  subcategoryName: string;
  lineSummary: string;
  warehouseName: string;
  quantity: number;
  lines: PRLineRow[];
  createdByName: string;
  createdAt: string;
  vendorRequestLabel: string | null;
};

export async function getApprovedPRsAwaitingPO(limit = 25): Promise<ApprovedPRAwaitingPO[]> {
  return cachedQuery(
    LIST_CACHE_TAGS.awaitingPo,
    [String(limit)],
    () => fetchApprovedPRsAwaitingPO(limit),
    { tags: [LIST_CACHE_TAGS.awaitingPo, LIST_CACHE_TAGS.purchaseOrders] },
  );
}

async function fetchApprovedPRsAwaitingPO(limit: number): Promise<ApprovedPRAwaitingPO[]> {
  const rows = await prisma.purchaseRequest.findMany({
    where: {
      status: PRStatus.APPROVED,
      executionType: ExecutionType.VENDOR_PURCHASE,
      purchaseOrder: null,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      quantity: true,
      createdAt: true,
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      lines: {
        orderBy: { lineNumber: "asc" },
        select: {
          id: true,
          lineNumber: true,
          categoryId: true,
          subcategoryId: true,
          quantity: true,
          notes: true,
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
        },
      },
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      vendorRequest: { select: { businessName: true, status: true } },
    },
  });

  return rows.map((pr) => {
    const lines: PRLineRow[] = pr.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      categoryId: line.categoryId,
      categoryName: line.category.name,
      subcategoryId: line.subcategoryId,
      subcategoryName: line.subcategory.name,
      quantity: line.quantity,
      notes: line.notes,
    }));
    const summary = formatLineSummary(lines);
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0) || (pr.quantity ?? 0);
    const primary = lines[0];

    return {
      id: pr.id,
      categoryName: primary?.categoryName ?? pr.category?.name ?? "—",
      subcategoryName: primary?.subcategoryName ?? pr.subcategory?.name ?? "—",
      lineSummary: summary.summary,
      warehouseName: pr.warehouse.name,
      quantity: totalQty,
      lines,
      createdByName: pr.createdBy.name,
      createdAt: pr.createdAt.toISOString(),
      vendorRequestLabel:
        pr.vendorRequest?.status === "PENDING"
          ? `${pr.vendorRequest.businessName} (pending activation)`
          : pr.vendorRequest
            ? pr.vendorRequest.businessName
            : null,
    };
  });
}
