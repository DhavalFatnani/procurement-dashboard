import { cache } from "react";

import {
  ExecutionType,
  InvoiceMatchStatus,
  PaymentStatus,
  POStatus,
  PRStatus,
  type Prisma,
} from "@/lib/prisma-client";

import { getCachedActiveVendorOptions, getCachedWarehouses } from "@/lib/cache";
import { dbParallel } from "@/lib/db-parallel";
import {
  resolveExceptionForLegacyLine,
  resolveExceptionForLineItem,
  toGrnExceptionSnapshot,
  type GrnExceptionSnapshot,
} from "@/lib/grn-exception-lines";
import { formatGrnReceiptLabel } from "@/lib/display-ref";
import { isVisibleGrnReceipt } from "@/lib/grn-pending-qty";
import { formatWarehouseLabel, warehouseOptionsFromRows } from "@/lib/format-warehouse";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { mapPrLinesFromDb, prLinesAwaitingPoSelect } from "@/lib/map-pr-lines";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import {
  aggregateInvoiceMatchStatus,
  aggregatePaymentStatus,
  buildClosureSnapshot,
  deliveryStatusLabel,
  type POWithRelations,
} from "@/lib/poAutoClose";
import {
  buildEffectiveLineMap,
  effectiveOrderedQtyForLegacyLine,
  effectiveOrderedQtyForLineItem,
  normalizePoLineAdjustments,
  type POLineAdjustmentRow,
} from "@/lib/po-line-effective";
import {
  hasPendingReplacement,
  pendingReplacementByPoLine,
} from "@/lib/po-replacement-pending";
import {
  buildReceivingLineRows,
  filterAttentionLines,
  type POReceiptContext,
  type POReceivingLineRow,
} from "@/lib/po-receiving-lines";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { timed } from "@/lib/server-timing";
import type { SessionUser } from "@/lib/session";
import { assertSessionCanAccessWarehouse } from "@/lib/warehouse-scope";
import {
  purchaseOrderWhereFromScopeIds,
  warehouseIdFilter,
} from "@/lib/warehouse-scope";
import {
  formatLineSummary,
  hasLockTagsLines,
  sumLineQuantities,
  sumOrderedQty,
  type POLineItemRow,
  type POLineRow,
  type PRLineRow,
} from "@/lib/purchase-lines";

export type PurchaseOrderFilters = {
  status?: POStatus;
  vendorId?: string;
  warehouseId?: string;
  prId?: string;
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

export type POGRNLineRow = {
  poLineItemId: string;
  lineNumber: number;
  lineItemNumber: number;
  label: string;
  receivedQty: number;
  acceptedQty: number;
  disputedQty: number;
  exception: GrnExceptionSnapshot | null;
};

export type POGRNRow = {
  id: string;
  receivedQty: number;
  acceptedQty: number;
  disputedQty: number;
  receivedByName: string;
  receivedAt: string;
  hasOpenDispute: boolean;
  /** Unresolved exceptions (including receipt-level) for GRN-level resolve UI. */
  openExceptions: GrnExceptionSnapshot[];
  lines: POGRNLineRow[];
};

export type POInvoicePaymentRow = {
  id: string;
  amount: string;
  method: string | null;
  transactionRef: string | null;
  paidAt: string | null;
  paidByName: string | null;
  proofSignedUrl: string | null;
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
  payments: POInvoicePaymentRow[];
};

export type PODetail = {
  id: string;
  prId: string;
  categoryName: string;
  subcategoryName: string;
  lineSummary: string;
  isLockTags: boolean;
  itemCount: number;
  orderedQty: number;
  unitPrice: string | null;
  lines: POLineRow[];
  lineItems: POLineItemRow[];
  expectedDelivery: string | null;
  gstApplicable: boolean;
  gstRatePercent: string | null;
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
    gst: string | null;
  };
  serialReservation: {
    series: string;
    rangeStart: string;
    rangeEnd: string;
    status: string;
  } | null;
  /** Count of GRNException rows with no resolution on this PO. */
  openDisputeCount: number;
  /** True when every exception on the PO is resolved (invoicing allowed). */
  readyForInvoice: boolean;
  reconciliation: {
    ordered: number;
    received: number;
    invoiced: number;
    advanced: number;
    settled: number;
    paid: number;
    checks: {
      id: string;
      label: string;
      done: boolean;
    }[];
  };
  grns: POGRNRow[];
  invoices: POInvoiceRow[];
  /** Lines with open dispute, pending receipt, or short-ship — Fulfillment attention table. */
  attentionLines: POReceivingLineRow[];
  /** Resolved replace outcomes still awaiting replacement GRN. */
  pendingReplacements: {
    poLineItemId: string;
    label: string;
    pendingQty: number;
  }[];
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
  if (filters.prId) {
    clauses.push({ prId: filters.prId });
  }
  if (filters.scopeWarehouseIds !== undefined) {
    clauses.push(purchaseOrderWhereFromScopeIds(filters.scopeWarehouseIds));
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
          vendor: { select: { businessName: true } },
          purchaseRequest: {
            select: { warehouse: { select: { name: true, location: true } } },
          },
        },
      }),
  });

  const poIds = paginated.items.map((po) => po.id);
  if (poIds.length === 0) {
    return { ...paginated, items: [] };
  }

  // Native Promise.all (not dbParallel): its tuple overloads infer groupBy's
  // `_sum` precisely; dbParallel's variadic signature degrades it to optional.
  const [grnAgg, invoiceRows] = await Promise.all([
    prisma.goodsReceipt.groupBy({
      by: ["poId"],
      where: { poId: { in: poIds } },
      _sum: { acceptedQty: true },
    }),
    prisma.invoice.findMany({
      where: { poId: { in: poIds } },
      select: { poId: true, matchStatus: true, paymentStatus: true },
    }),
  ]);

  const receivedByPo = new Map(
    grnAgg.map((row) => [row.poId, row._sum.acceptedQty ?? 0]),
  );
  const invoicesByPo = new Map<string, { matchStatus: InvoiceMatchStatus; paymentStatus: PaymentStatus }[]>();
  for (const inv of invoiceRows) {
    const list = invoicesByPo.get(inv.poId) ?? [];
    list.push(inv);
    invoicesByPo.set(inv.poId, list);
  }

  const items: PurchaseOrderListRow[] = paginated.items.map((po) => {
    const receivedQty = receivedByPo.get(po.id) ?? 0;
    const invoices = invoicesByPo.get(po.id) ?? [];
    const orderedQty = po.orderedQty ?? 0;
    return {
      id: po.id,
      prId: po.prId,
      vendorName: po.vendor.businessName,
      warehouseName: formatWarehouseLabel(
        po.purchaseRequest.warehouse.name,
        po.purchaseRequest.warehouse.location,
      ),
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
  });

  return {
    ...paginated,
    items,
  };
}

export const getPOById = cache(async (id: string): Promise<PODetail | null> => {
  const po = await cachedQuery(
    LIST_CACHE_TAGS.poDetail,
    [id],
    () => fetchPOById(id),
    { tags: [LIST_CACHE_TAGS.poDetail, `${LIST_CACHE_TAGS.poDetail}:${id}`] },
  );
  if (!po) {
    return null;
  }
  return {
    ...po,
    attentionLines: po.attentionLines ?? [],
  };
});

/** One lightweight access check, then cached PO detail (avoids extra pooler round-trips). */
export async function getPOByIdForPage(
  user: SessionUser,
  id: string,
): Promise<PODetail | null> {
  // A PO's warehouse is immutable, so cache the access-scope lookup instead of
  // re-querying it uncached on every navigation.
  const warehouseId = await cachedQuery(
    "po-warehouse",
    [id],
    async () => {
      const r = await prisma.purchaseOrder.findUnique({
        where: { id },
        select: { purchaseRequest: { select: { warehouseId: true } } },
      });
      return r?.purchaseRequest.warehouseId ?? null;
    },
    { revalidate: 3600, tags: [`${LIST_CACHE_TAGS.poDetail}:${id}`] },
  );
  if (!warehouseId) {
    return null;
  }
  const access = assertSessionCanAccessWarehouse(user, warehouseId);
  if (!access.ok) {
    return null;
  }
  const po = await getPOById(id);
  if (!po) {
    return null;
  }
  return hydratePoPaymentProofSignedUrls(po);
}

async function hydratePoPaymentProofSignedUrls(po: PODetail): Promise<PODetail> {
  const rows = await prisma.payment.findMany({
    where: {
      invoice: { poId: po.id },
      proofUrl: { not: null },
    },
    select: { id: true, proofUrl: true },
  });
  if (rows.length === 0) {
    return po;
  }
  const { createStorageSignedUrl } = await import("@/lib/upload-storage");
  const signedEntries = await Promise.all(
    rows.map(async (row) => {
      const url = await createStorageSignedUrl(
        STORAGE_BUCKETS.paymentProofs,
        row.proofUrl!,
      );
      return [row.id, url] as const;
    }),
  );
  const signedById = new Map(signedEntries);
  return {
    ...po,
    invoices: po.invoices.map((inv) => ({
      ...inv,
      payments: inv.payments.map((payment) => ({
        ...payment,
        proofSignedUrl: signedById.get(payment.id) ?? payment.proofSignedUrl,
      })),
    })),
  };
}

async function fetchPOById(id: string): Promise<PODetail | null> {
  return timed("query.fetchPOById", async () => {
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
          gst: true,
        },
      },
      lineItems: {
        include: {
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          catalogItem: { select: { name: true, sku: true, unit: true } },
          prLineItem: {
            select: {
              lineItemNumber: true,
              prLine: { select: { lineNumber: true, categoryId: true, subcategoryId: true } },
            },
          },
          goodsReceiptLineItems: { select: { acceptedQty: true } },
        },
      },
      purchaseRequest: {
        select: {
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
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
          lineItems: {
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
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { name: true } },
          grnLinks: { select: { grnId: true } },
          payments: {
            orderBy: { paidAt: "desc" },
            select: {
              id: true,
              amount: true,
              method: true,
              transactionRef: true,
              paidAt: true,
              proofUrl: true,
              paidBy: { select: { name: true } },
            },
          },
          advanceAllocations: { select: { amount: true } },
        },
      },
      advancePayments: {
        include: { allocations: { select: { amount: true } } },
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
          grnException: { select: { resolutionOutcome: true } },
        },
      },
    },
  });

  if (!po) {
    return null;
  }

  const legacyLines =
    po.lineItems.length === 0
      ? await prisma.purchaseOrderLine.findMany({
          where: { poId: id },
          orderBy: { prLine: { lineNumber: "asc" } },
          include: {
            category: { select: { name: true } },
            subcategory: { select: { name: true } },
            prLine: { select: { lineNumber: true } },
            goodsReceiptLines: { select: { acceptedQty: true } },
          },
        })
      : [];

  const lineAdjustments = normalizePoLineAdjustments(
    po.lineAdjustments,
  ) as POWithRelations["lineAdjustments"];

  const poForClosure = {
    ...po,
    lines: legacyLines,
    lineAdjustments,
  } as POWithRelations;

  const snapshot = buildClosureSnapshot(poForClosure);

  const openDisputeCount = po.grns.reduce(
    (sum, g) => sum + g.exceptions.filter((e) => e.resolutionStatus == null).length,
    0,
  );

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
      label: "All invoices settled",
      done: snapshot.checks.allInvoicesPaid,
    },
    {
      id: "disputes",
      label: "No open GRN disputes",
      done: snapshot.checks.noOpenDisputes,
    },
    {
      id: "replacement",
      label: "No pending replacement receipts",
      done: snapshot.checks.noPendingReplacement,
    },
  ];

  const sortedLineItems = sortPoLineItems(po.lineItems);
  const effectiveMap = buildEffectiveLineMap(lineAdjustments);

  const allExceptions = po.grns.flatMap((g) => g.exceptions);
  const acceptedByLineItem = new Map(
    sortedLineItems.map((line) => [
      line.id,
      line.goodsReceiptLineItems.reduce((s, grl) => s + grl.acceptedQty, 0),
    ]),
  );
  const effectiveOrderedByLineItem = new Map(
    sortedLineItems.map((line) => [
      line.id,
      effectiveOrderedQtyForLineItem(line.id, line.orderedQty, effectiveMap),
    ]),
  );
  const pendingReplacementLines = pendingReplacementByPoLine(
    allExceptions,
    acceptedByLineItem,
    effectiveOrderedByLineItem,
  );
  const pendingReplacement = pendingReplacementLines.length > 0;

  const lineItemRows: POLineItemRow[] = sortedLineItems.flatMap((line) => {
    if (!line.category || !line.subcategory || !line.catalogItem) {
      return [];
    }
    const prLine = line.prLineItem?.prLine;
    const lineNumber = prLine?.lineNumber ?? 0;
    const lineItemNumber = line.prLineItem?.lineItemNumber ?? 0;
    return [
      {
        id: line.id,
        prLineItemId: line.prLineItemId,
        isDisputeSplitLine: line.prLineItemId == null,
        lineNumber,
        lineItemNumber,
        categoryId: line.categoryId,
        categoryName: line.category.name,
        subcategoryId: line.subcategoryId,
        subcategoryName: line.subcategory.name,
        itemName: line.catalogItem.name,
        sku: line.catalogItem.sku,
        unit: line.catalogItem.unit,
        orderedQty: line.orderedQty,
        effectiveOrderedQty: effectiveOrderedQtyForLineItem(
          line.id,
          line.orderedQty,
          effectiveMap,
        ),
        unitPrice: line.unitPrice.toString(),
        receivedQty: line.goodsReceiptLineItems.reduce((s, grl) => s + grl.acceptedQty, 0),
      },
    ];
  });

  const pendingReplacements = pendingReplacementLines.map((p) => {
    const line = lineItemRows.find((l) => l.id === p.poLineItemId);
    return {
      poLineItemId: p.poLineItemId,
      label: line
        ? `Line ${line.lineNumber}${line.lineItemNumber > 1 ? `.${line.lineItemNumber}` : ""}: ${line.itemName}`
        : p.poLineItemId,
      pendingQty: p.pendingQty,
    };
  });

  const lineRows: POLineRow[] = legacyLines.map((line) => ({
    id: line.id,
    prLineId: line.prLineId,
    lineNumber: line.prLine.lineNumber,
    categoryId: line.categoryId,
    categoryName: line.category.name,
    subcategoryId: line.subcategoryId,
    subcategoryName: line.subcategory.name,
    orderedQty: line.orderedQty,
    effectiveOrderedQty: effectiveOrderedQtyForLegacyLine(
      line.id,
      line.orderedQty,
      effectiveMap,
    ),
    unitPrice: line.unitPrice.toString(),
    receivedQty: line.goodsReceiptLines.reduce((s, grl) => s + grl.acceptedQty, 0),
  }));

  const prLineSummary = formatLineSummary(
    displayLinesForSummary(lineItemRows, lineRows),
  );

  const displayLines = lineItemRows.length > 0 ? lineItemRows : lineRows;
  const grnRows: POGRNRow[] = po.grns.filter(isVisibleGrnReceipt).map((g) => {
    const grnLines: POGRNLineRow[] =
      g.lineItems.length > 0
        ? sortGrnLineItems(g.lineItems).flatMap((line) => {
            const poLine = line.purchaseOrderLineItem;
            if (!poLine || !poLine.category || !poLine.subcategory || !poLine.catalogItem) {
              return [];
            }
            const prLine = poLine.prLineItem?.prLine;
            const exception = resolveExceptionForLineItem(
              g.exceptions,
              line.poLineItemId,
              line.disputedQty,
            );
            return [
              {
                poLineItemId: line.poLineItemId,
                lineNumber: prLine?.lineNumber ?? 0,
                lineItemNumber: poLine.prLineItem?.lineItemNumber ?? 0,
                label: `${poLine.category.name} / ${poLine.subcategory.name} · ${poLine.catalogItem.name}`,
                receivedQty: line.receivedQty,
                acceptedQty: line.acceptedQty,
                disputedQty: line.disputedQty,
                exception,
              },
            ];
          })
        : sortGrnLegacyLines(g.lines).flatMap((line) => {
            const poLine = line.purchaseOrderLine;
            if (!poLine?.prLine || !poLine.category || !poLine.subcategory) {
              return [];
            }
            const exception = resolveExceptionForLegacyLine(
              g.exceptions,
              line.poLineId,
              line.disputedQty,
            );
            return [
              {
                poLineItemId: line.poLineId,
                lineNumber: poLine.prLine.lineNumber,
                lineItemNumber: 1,
                label: `${poLine.category.name} / ${poLine.subcategory.name}`,
                receivedQty: line.receivedQty,
                acceptedQty: line.acceptedQty,
                disputedQty: line.disputedQty,
                exception,
              },
            ];
          });

    const openExceptions = g.exceptions
      .filter((e) => e.resolutionStatus == null)
      .map(toGrnExceptionSnapshot);

    return {
      id: g.id,
      receivedQty: g.receivedQty,
      acceptedQty: g.acceptedQty,
      disputedQty: g.disputedQty,
      receivedByName: g.receivedBy.name,
      receivedAt: g.receivedAt.toISOString(),
      hasOpenDispute: openExceptions.length > 0,
      openExceptions,
      lines: grnLines,
    };
  });
  const orderedQty = snapshot.orderedQty;
  const itemCount =
    lineItemRows.length > 0 ? lineItemRows.length : lineRows.length;
  const isLockTags =
    displayLines.length > 0
      ? hasLockTagsLines(
          (lineItemRows.length > 0 ? lineItemRows : lineRows).map((l) => ({
            categoryName: l.categoryName,
          })),
        )
      : po.purchaseRequest.category?.name === "Lock Tags";

  return {
    id: po.id,
    prId: po.prId,
    categoryName: lineRows[0]?.categoryName ?? po.purchaseRequest.category?.name ?? "—",
    subcategoryName: lineRows[0]?.subcategoryName ?? po.purchaseRequest.subcategory?.name ?? "—",
    lineSummary: prLineSummary.summary,
    isLockTags,
    itemCount,
    orderedQty,
    unitPrice:
      lineItemRows.length === 1
        ? lineItemRows[0]!.unitPrice
        : lineRows.length === 1
          ? lineRows[0]!.unitPrice
          : (po.unitPrice?.toString() ?? null),
    lines: lineRows,
    lineItems: lineItemRows,
    expectedDelivery: po.expectedDelivery?.toISOString() ?? null,
    gstApplicable: po.gstApplicable,
    gstRatePercent: po.gstRatePercent?.toString() ?? null,
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
    openDisputeCount,
    readyForInvoice: openDisputeCount === 0 && !pendingReplacement,
    reconciliation: {
      ordered: snapshot.orderedQty,
      received: snapshot.receivedQty,
      invoiced: snapshot.invoicedAmount,
      advanced: snapshot.advancePaid,
      settled: snapshot.settledAmount,
      paid: snapshot.settledAmount,
      checks: closureLabels,
    },
    grns: grnRows,
    attentionLines: buildPoAttentionLines(
      po.id,
      grnRows,
      lineItemRows,
      lineRows,
      lineAdjustments,
      po.status,
    ),
    pendingReplacements,
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
      payments: inv.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount?.toString() ?? "0",
        method: payment.method,
        transactionRef: payment.transactionRef,
        paidAt: payment.paidAt?.toISOString() ?? null,
        paidByName: payment.paidBy?.name ?? null,
        proofSignedUrl: null,
      })),
    })),
  };
  });
}

function receiptContextForOpenException(
  poId: string,
  grnRows: POGRNRow[],
  lineId: string,
  openException: GrnExceptionSnapshot,
): POReceiptContext | null {
  for (const g of grnRows) {
    for (const gl of g.lines) {
      if (
        gl.poLineItemId === lineId &&
        gl.exception?.id === openException.id
      ) {
        return {
          grnId: g.id,
          receiptLabel: formatGrnReceiptLabel(
            poId,
            g.receivedAt,
            g.receivedByName,
          ),
          receivedQty: gl.receivedQty,
          acceptedQty: gl.acceptedQty,
          disputedQty: gl.disputedQty,
          exceptionQty: openException.exceptionQty,
        };
      }
    }
  }
  return null;
}

function buildPoAttentionLines(
  poId: string,
  grnRows: POGRNRow[],
  lineItemRows: POLineItemRow[],
  lineRows: POLineRow[],
  lineAdjustments: POLineAdjustmentRow[],
  poStatus: POStatus,
): POReceivingLineRow[] {
  const receivingInputs =
    lineItemRows.length > 0
      ? lineItemRows.map((line) => {
          const grnIdsWithOpenDispute: string[] = [];
          let openException: GrnExceptionSnapshot | null = null;
          for (const g of grnRows) {
            for (const gl of g.lines) {
              if (
                gl.poLineItemId === line.id &&
                gl.exception &&
                !gl.exception.resolutionStatus
              ) {
                openException = gl.exception;
                grnIdsWithOpenDispute.push(g.id);
              }
            }
          }
          return {
            lineKey: `item:${line.id}`,
            lineId: line.id,
            lineNumber: line.lineNumber,
            lineItemNumber: line.lineItemNumber,
            label: line.itemName,
            originalOrderedQty: line.orderedQty,
            acceptedQty: line.receivedQty,
            unitPrice: line.unitPrice,
            openException,
            grnIdsWithOpenDispute,
            receiptContext: openException
              ? receiptContextForOpenException(poId, grnRows, line.id, openException)
              : null,
          };
        })
      : lineRows.map((line) => {
          const grnIdsWithOpenDispute: string[] = [];
          let openException: GrnExceptionSnapshot | null = null;
          for (const g of grnRows) {
            for (const gl of g.lines) {
              if (
                gl.poLineItemId === line.id &&
                gl.exception &&
                !gl.exception.resolutionStatus
              ) {
                openException = gl.exception;
                grnIdsWithOpenDispute.push(g.id);
              }
            }
          }
          return {
            lineKey: `line:${line.id}`,
            lineId: line.id,
            lineNumber: line.lineNumber,
            lineItemNumber: 1,
            label: `${line.categoryName} / ${line.subcategoryName}`,
            originalOrderedQty: line.orderedQty,
            acceptedQty: line.receivedQty,
            unitPrice: line.unitPrice,
            openException,
            grnIdsWithOpenDispute,
            receiptContext: openException
              ? receiptContextForOpenException(poId, grnRows, line.id, openException)
              : null,
          };
        });

  return filterAttentionLines(
    buildReceivingLineRows(receivingInputs, lineAdjustments, poStatus),
  );
}

function sortPoLineItems<
  T extends {
    prLineItem: {
      prLine: { lineNumber: number };
      lineItemNumber: number;
    } | null;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aLine = a.prLineItem?.prLine.lineNumber ?? 9999;
    const bLine = b.prLineItem?.prLine.lineNumber ?? 9999;
    const byLine = aLine - bLine;
    if (byLine !== 0) {
      return byLine;
    }
    return (
      (a.prLineItem?.lineItemNumber ?? 0) - (b.prLineItem?.lineItemNumber ?? 0)
    );
  });
}

function sortGrnLineItems<
  T extends {
    purchaseOrderLineItem: {
      prLineItem: {
        prLine: { lineNumber: number };
        lineItemNumber: number;
      } | null;
    };
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aLine = a.purchaseOrderLineItem.prLineItem;
    const bLine = b.purchaseOrderLineItem.prLineItem;
    const byLine =
      (aLine?.prLine.lineNumber ?? 9999) - (bLine?.prLine.lineNumber ?? 9999);
    return byLine !== 0 ? byLine : (aLine?.lineItemNumber ?? 0) - (bLine?.lineItemNumber ?? 0);
  });
}

function sortGrnLegacyLines<
  T extends { purchaseOrderLine: { prLine: { lineNumber: number } } },
>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.purchaseOrderLine.prLine.lineNumber - b.purchaseOrderLine.prLine.lineNumber,
  );
}

function displayLinesForSummary(
  lineItemRows: POLineItemRow[],
  lineRows: POLineRow[],
): { subcategoryName: string; categoryName: string }[] {
  if (lineItemRows.length > 0) {
    return lineItemRows.map((l) => ({
      subcategoryName: l.subcategoryName,
      categoryName: l.categoryName,
    }));
  }
  return lineRows.map((l) => ({
    subcategoryName: l.subcategoryName,
    categoryName: l.categoryName,
  }));
}

export const getPOFilterOptions = cache(async () => {
  const [vendors, warehouses] = await dbParallel(
    () => getCachedActiveVendorOptions(),
    () => getCachedWarehouses(),
  );
  return { vendors, warehouses: warehouseOptionsFromRows(warehouses) };
});

export type ApprovedPRLineItemRow = {
  id: string;
  prLineItemId: string;
  catalogItemId: string;
  lineNumber: number;
  lineItemNumber: number;
  categoryName: string;
  subcategoryName: string;
  itemName: string;
  sku: string | null;
  unit: string;
  quantity: number;
  /** Unit price from the most recent PO for this catalog item, if any. */
  previousUnitPrice: string | null;
  alreadyOnPo: boolean;
  existingPoId: string | null;
};

export type ApprovedPRPurchaseOrderSummary = {
  id: string;
  vendorName: string;
  itemCount: number;
  orderedQty: number;
  createdAt: string;
};

export type ApprovedPRAwaitingPO = {
  id: string;
  categoryName: string;
  subcategoryName: string;
  lineSummary: string;
  warehouseName: string;
  itemCount: number;
  quantity: number;
  lines: PRLineRow[];
  lineItems: ApprovedPRLineItemRow[];
  createdByName: string;
  createdAt: string;
  vendorRequestLabel: string | null;
  poProgress: { assigned: number; total: number };
  existingPurchaseOrders: ApprovedPRPurchaseOrderSummary[];
};

export async function getApprovedPRsAwaitingPO(
  filters: { scopeWarehouseIds?: string[]; limit?: number } = {},
): Promise<ApprovedPRAwaitingPO[]> {
  const limit = filters.limit ?? 25;
  return cachedQuery(
    LIST_CACHE_TAGS.awaitingPo,
    [String(limit), (filters.scopeWarehouseIds ?? []).join(",")],
    () => fetchApprovedPRsAwaitingPO(limit, filters.scopeWarehouseIds),
    { tags: [LIST_CACHE_TAGS.awaitingPo, LIST_CACHE_TAGS.purchaseOrders] },
  );
}

export async function getApprovedPRAwaitingPOById(
  prId: string,
  filters: { scopeWarehouseIds?: string[] } = {},
): Promise<ApprovedPRAwaitingPO | null> {
  return cachedQuery(
    LIST_CACHE_TAGS.awaitingPo,
    ["byId", prId, (filters.scopeWarehouseIds ?? []).join(",")],
    () => fetchApprovedPRAwaitingPOById(prId, filters.scopeWarehouseIds),
    { tags: [LIST_CACHE_TAGS.awaitingPo, LIST_CACHE_TAGS.purchaseOrders] },
  );
}

async function fetchLastPoUnitPricesByCatalogItem(
  catalogItemIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(catalogItemIds)];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.purchaseOrderLineItem.findMany({
    where: { catalogItemId: { in: uniqueIds } },
    orderBy: { purchaseOrder: { createdAt: "desc" } },
    distinct: ["catalogItemId"],
    select: {
      catalogItemId: true,
      unitPrice: true,
    },
  });

  return new Map(rows.map((row) => [row.catalogItemId, row.unitPrice.toString()]));
}

const awaitingPoPrSelect = {
  id: true,
  quantity: true,
  createdAt: true,
  category: { select: { name: true } },
  subcategory: { select: { name: true } },
  lines: prLinesAwaitingPoSelect,
  warehouse: { select: { name: true, location: true } },
  createdBy: { select: { name: true } },
  vendorRequest: { select: { businessName: true, status: true } },
  purchaseOrders: {
    select: {
      id: true,
      orderedQty: true,
      createdAt: true,
      vendor: { select: { businessName: true } },
      lineItems: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

function awaitingPoWhere(scopeWarehouseIds?: string[]) {
  return {
    status: PRStatus.APPROVED,
    executionType: ExecutionType.VENDOR_PURCHASE,
    lines: {
      some: {
        items: {
          some: {
            poLineItem: null,
          },
        },
      },
    },
    ...(scopeWarehouseIds !== undefined
      ? { warehouseId: warehouseIdFilter(scopeWarehouseIds) }
      : {}),
  };
}

type AwaitingPoPrRow = Awaited<
  ReturnType<
    typeof prisma.purchaseRequest.findMany<{ select: typeof awaitingPoPrSelect }>
  >
>[number];

function mapAwaitingPoRow(
  pr: AwaitingPoPrRow,
  previousRatesByCatalogItem: Map<string, string>,
): ApprovedPRAwaitingPO {
  const lines = mapPrLinesFromDb(pr.lines);
  const rawItems = pr.lines.flatMap((line) =>
    line.items.map((item) => ({
      line,
      item,
    })),
  );
  const lineItems: ApprovedPRLineItemRow[] = lines.flatMap((line) =>
    line.items.map((item) => {
      const raw = rawItems.find((r) => r.item.id === item.id);
      const poId = raw?.item.poLineItem?.poId ?? null;
      return {
        id: item.id,
        prLineItemId: item.id,
        catalogItemId: item.catalogItemId,
        lineNumber: line.lineNumber,
        lineItemNumber: item.lineItemNumber,
        categoryName: line.categoryName,
        subcategoryName: line.subcategoryName,
        itemName: item.itemName,
        sku: item.sku,
        unit: item.unit,
        quantity: item.quantity,
        previousUnitPrice: previousRatesByCatalogItem.get(item.catalogItemId) ?? null,
        alreadyOnPo: poId != null,
        existingPoId: poId,
      };
    }),
  );
  const summary = formatLineSummary(lines);
  const totalQty = sumLineQuantities(lines) || (pr.quantity ?? 0);
  const primary = lines[0];
  const assigned = lineItems.filter((item) => item.alreadyOnPo).length;

  return {
    id: pr.id,
    categoryName: primary?.categoryName ?? pr.category?.name ?? "—",
    subcategoryName: primary?.subcategoryName ?? pr.subcategory?.name ?? "—",
    lineSummary: summary.summary,
    warehouseName: formatWarehouseLabel(pr.warehouse.name, pr.warehouse.location),
    itemCount: lineItems.length,
    quantity: totalQty,
    lines,
    lineItems,
    createdByName: pr.createdBy.name,
    createdAt: pr.createdAt.toISOString(),
    vendorRequestLabel:
      pr.vendorRequest?.status === "PENDING"
        ? `${pr.vendorRequest.businessName} (pending activation)`
        : pr.vendorRequest
          ? pr.vendorRequest.businessName
          : null,
    poProgress: { assigned, total: lineItems.length },
    existingPurchaseOrders: pr.purchaseOrders.map((po) => ({
      id: po.id,
      vendorName: po.vendor.businessName,
      itemCount: po.lineItems.length,
      orderedQty: po.orderedQty ?? 0,
      createdAt: po.createdAt.toISOString(),
    })),
  };
}

async function mapAwaitingPoRows(
  rows: AwaitingPoPrRow[],
): Promise<ApprovedPRAwaitingPO[]> {
  const catalogItemIds = rows.flatMap((pr) =>
    pr.lines.flatMap((line) => line.items.map((item) => item.catalogItemId)),
  );
  const previousRatesByCatalogItem = await fetchLastPoUnitPricesByCatalogItem(catalogItemIds);
  return rows.map((pr) => mapAwaitingPoRow(pr, previousRatesByCatalogItem));
}

async function fetchApprovedPRsAwaitingPO(
  limit: number,
  scopeWarehouseIds?: string[],
): Promise<ApprovedPRAwaitingPO[]> {
  const rows = await prisma.purchaseRequest.findMany({
    where: awaitingPoWhere(scopeWarehouseIds),
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: awaitingPoPrSelect,
  });
  return mapAwaitingPoRows(rows);
}

function configurePoPrWhere(prId: string, scopeWarehouseIds?: string[]) {
  return {
    id: prId,
    status: PRStatus.APPROVED,
    executionType: ExecutionType.VENDOR_PURCHASE,
    ...(scopeWarehouseIds !== undefined
      ? { warehouseId: warehouseIdFilter(scopeWarehouseIds) }
      : {}),
  };
}

async function fetchApprovedPRAwaitingPOById(
  prId: string,
  scopeWarehouseIds?: string[],
): Promise<ApprovedPRAwaitingPO | null> {
  const pr = await prisma.purchaseRequest.findFirst({
    where: configurePoPrWhere(prId, scopeWarehouseIds),
    select: awaitingPoPrSelect,
  });
  if (!pr) {
    return null;
  }
  const [mapped] = await mapAwaitingPoRows([pr]);
  return mapped ?? null;
}
