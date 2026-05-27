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
import {
  resolveExceptionForLegacyLine,
  resolveExceptionForLineItem,
  type GrnExceptionSnapshot,
} from "@/lib/grn-exception-lines";
import { formatWarehouseLabel, warehouseOptionsFromRows } from "@/lib/format-warehouse";
import { mapPrLinesFromDb, prLinesInclude } from "@/lib/map-pr-lines";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import {
  aggregateInvoiceMatchStatus,
  aggregatePaymentStatus,
  buildClosureSnapshot,
  deliveryStatusLabel,
} from "@/lib/poAutoClose";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { timed } from "@/lib/server-timing";
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
  lines: POGRNLineRow[];
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
  lineItems: POLineItemRow[];
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
        },
      },
      lineItems: {
        orderBy: [
          { prLineItem: { prLine: { lineNumber: "asc" } } },
          { prLineItem: { lineItemNumber: "asc" } },
        ],
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

  const poForClosure = {
    ...po,
    lines: legacyLines,
  };

  const snapshot = buildClosureSnapshot(poForClosure);

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

  const lineItemRows: POLineItemRow[] = po.lineItems.map((line) => ({
    id: line.id,
    prLineItemId: line.prLineItemId,
    lineNumber: line.prLineItem.prLine.lineNumber,
    lineItemNumber: line.prLineItem.lineItemNumber,
    categoryId: line.categoryId,
    categoryName: line.category.name,
    subcategoryId: line.subcategoryId,
    subcategoryName: line.subcategory.name,
    itemName: line.catalogItem.name,
    sku: line.catalogItem.sku,
    unit: line.catalogItem.unit,
    orderedQty: line.orderedQty,
    unitPrice: line.unitPrice.toString(),
    receivedQty: line.goodsReceiptLineItems.reduce((s, grl) => s + grl.acceptedQty, 0),
  }));

  const lineRows: POLineRow[] = legacyLines.map((line) => ({
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
    displayLinesForSummary(lineItemRows, lineRows),
  );

  const displayLines = lineItemRows.length > 0 ? lineItemRows : lineRows;
  const orderedQty =
    lineItemRows.length > 0
      ? lineItemRows.reduce((s, l) => s + l.orderedQty, 0)
      : lineRows.length > 0
        ? sumOrderedQty(lineRows)
        : (po.orderedQty ?? 0);
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
    grns: po.grns.map((g) => {
      const grnLines: POGRNLineRow[] =
        g.lineItems.length > 0
          ? g.lineItems.map((line) => {
              const poLine = line.purchaseOrderLineItem;
              const exception = resolveExceptionForLineItem(
                g.exceptions,
                line.poLineItemId,
                line.disputedQty,
              );
              return {
                poLineItemId: line.poLineItemId,
                lineNumber: poLine.prLineItem.prLine.lineNumber,
                lineItemNumber: poLine.prLineItem.lineItemNumber,
                label: `${poLine.category.name} / ${poLine.subcategory.name} · ${poLine.catalogItem.name}`,
                receivedQty: line.receivedQty,
                acceptedQty: line.acceptedQty,
                disputedQty: line.disputedQty,
                exception,
              };
            })
          : g.lines.map((line) => {
              const poLine = line.purchaseOrderLine;
              const exception = resolveExceptionForLegacyLine(
                g.exceptions,
                line.poLineId,
                line.disputedQty,
              );
              return {
                poLineItemId: line.poLineId,
                lineNumber: poLine.prLine.lineNumber,
                lineItemNumber: 1,
                label: `${poLine.category.name} / ${poLine.subcategory.name}`,
                receivedQty: line.receivedQty,
                acceptedQty: line.acceptedQty,
                disputedQty: line.disputedQty,
                exception,
              };
            });

      return {
        id: g.id,
        receivedQty: g.receivedQty,
        acceptedQty: g.acceptedQty,
        disputedQty: g.disputedQty,
        receivedByName: g.receivedBy.name,
        receivedAt: g.receivedAt.toISOString(),
        hasOpenDispute:
          g.disputedQty > 0 && g.exceptions.some((e) => e.resolutionStatus == null),
        lines: grnLines,
      };
    }),
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
  });
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
  lineNumber: number;
  lineItemNumber: number;
  categoryName: string;
  subcategoryName: string;
  itemName: string;
  sku: string | null;
  unit: string;
  quantity: number;
};

export type ApprovedPRAwaitingPO = {
  id: string;
  categoryName: string;
  subcategoryName: string;
  lineSummary: string;
  warehouseName: string;
  quantity: number;
  lines: PRLineRow[];
  lineItems: ApprovedPRLineItemRow[];
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
      lines: prLinesInclude,
      warehouse: { select: { name: true, location: true } },
      createdBy: { select: { name: true } },
      vendorRequest: { select: { businessName: true, status: true } },
    },
  });

  return rows.map((pr) => {
    const lines = mapPrLinesFromDb(pr.lines);
    const lineItems: ApprovedPRLineItemRow[] = lines.flatMap((line) =>
      line.items.map((item) => ({
        id: item.id,
        prLineItemId: item.id,
        lineNumber: line.lineNumber,
        lineItemNumber: item.lineItemNumber,
        categoryName: line.categoryName,
        subcategoryName: line.subcategoryName,
        itemName: item.itemName,
        sku: item.sku,
        unit: item.unit,
        quantity: item.quantity,
      })),
    );
    const summary = formatLineSummary(lines);
    const totalQty = sumLineQuantities(lines) || (pr.quantity ?? 0);
    const primary = lines[0];

    return {
      id: pr.id,
      categoryName: primary?.categoryName ?? pr.category?.name ?? "—",
      subcategoryName: primary?.subcategoryName ?? pr.subcategory?.name ?? "—",
      lineSummary: summary.summary,
      warehouseName: formatWarehouseLabel(pr.warehouse.name, pr.warehouse.location),
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
    };
  });
}
