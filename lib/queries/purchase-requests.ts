import { cache } from "react";
import { ExecutionType, InvoiceMatchStatus, POStatus, PaymentStatus, PRStatus, Role } from "@/lib/prisma-enums";

import {
  getCachedActiveCatalogItems,
  getCachedCategories,
  getCachedCreators,
  getCachedWarehouses,
} from "@/lib/cache";
import { mapPrLinesFromDb, prLinesInclude } from "@/lib/map-pr-lines";
import { dbParallel } from "@/lib/db-parallel";
import {
  formatWarehouseLabel,
  type WarehouseOption,
  warehouseOptionsFromRows,
} from "@/lib/format-warehouse";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import {
  aggregateInvoiceMatchStatus,
  aggregatePaymentStatus,
} from "@/lib/po-closure-snapshot";
import { prVersionActionLabel } from "@/lib/pr-version-label";
import { prisma } from "@/lib/prisma";
import { timed } from "@/lib/server-timing";
import {
  formatLineSummary,
  sumLineQuantities,
  type PRLineRow,
} from "@/lib/purchase-lines";
import type { SessionUser } from "@/lib/session";
import { canViewPurchaseRequest, prDetailNeedsFilterOptions } from "@/lib/pr-access";
import { warehouseScopeForUser } from "@/lib/warehouse-scope";

export type { PRLineRow };

export type PurchaseRequestListRow = {
  id: string;
  categoryName: string;
  subcategoryName: string;
  lineSummary: string;
  lineCount: number;
  itemCount: number;
  warehouseName: string;
  quantity: number;
  vendorName: string | null;
  executionType: ExecutionType;
  status: PRStatus;
  versionLabel: string;
  createdByName: string;
  createdAt: string;
  /** Line items already on a PO vs total catalog line items (vendor purchase only) */
  poProgress?: { assigned: number; total: number };
};

export type CategoryOption = { id: string; name: string };
export type SubcategoryOption = {
  id: string;
  name: string;
  categoryId: string;
  executionType: ExecutionType;
};

export type CatalogItemOption = {
  id: string;
  subcategoryId: string;
  name: string;
  sku: string | null;
  unit: string;
};

export type PendingCatalogItemRow = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  subcategoryName: string;
  categoryName: string;
};
export type { WarehouseOption } from "@/lib/format-warehouse";
export type UserOption = { id: string; name: string };

export type PurchaseRequestFilters = {
  statuses?: PRStatus[];
  categoryId?: string;
  subcategoryId?: string;
  executionType?: ExecutionType;
  warehouseId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  /** When true, runs COUNT(*) for exact pagination totals */
  includeExactCount?: boolean;
};

export type PRDetail = {
  id: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  lineSummary: string;
  lineCount: number;
  itemCount: number;
  quantity: number;
  lines: PRLineRow[];
  warehouseId: string;
  warehouseName: string;
  vendorId: string | null;
  vendorName: string | null;
  executionType: ExecutionType;
  status: PRStatus;
  currentVersion: number;
  revisionCount: number;
  vendorRequestId: string | null;
  vendorRequestStatus: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  versions: {
    id: string;
    versionNumber: number;
    actionLabel: string;
    changedByName: string;
    changedAt: string;
    revisionComment: string | null;
  }[];
  purchaseOrders: {
    id: string;
    status: POStatus;
    vendorName: string;
    createdAt: string;
    itemCount: number;
    orderedQty: number;
    invoiceMatchStatus: InvoiceMatchStatus;
    paymentStatus: PaymentStatus;
  }[];
  /** First PO when any exist — convenience for legacy callers */
  purchaseOrder: { id: string; status: POStatus; createdAt: string } | null;
  poProgress: { assigned: number; total: number };
  serialReservation: {
    id: string;
    series: string;
    rangeStart: string;
    rangeEnd: string;
    quantity: number;
    createdByName: string;
    createdAt: string;
  } | null;
  latestRevision: {
    comment: string;
    byName: string;
    at: string;
  } | null;
  pendingCatalogItems: PendingCatalogItemRow[];
  progress: {
    prApproved: boolean;
    prApprovedAt: string | null;
    poCreated: boolean;
    poCreatedAt: string | null;
    grnRecorded: boolean;
    grnRecordedAt: string | null;
    invoiceUploaded: boolean;
    invoiceUploadedAt: string | null;
    paymentReceived: boolean;
    paymentReceivedAt: string | null;
  };
};

export const getListFilterOptions = cache(async (): Promise<{
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  warehouses: WarehouseOption[];
  creators: UserOption[];
}> => {
  const [categoriesWithSubs, warehouses, creators] = await dbParallel(
    () => getCachedCategories(),
    () => getCachedWarehouses(),
    () => getCachedCreators(),
  );

  const categories = categoriesWithSubs.map((c) => ({ id: c.id, name: c.name }));
  const subcategories = categoriesWithSubs
    .flatMap((c) => c.subcategories)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({
      id: s.id,
      name: s.name,
      categoryId: s.categoryId,
      executionType: s.executionType,
    }));

  return {
    categories,
    subcategories,
    warehouses: warehouseOptionsFromRows(warehouses),
    creators,
  };
});

/** Empty filter payload when PR detail does not need line-editing catalogs. */
export const EMPTY_PR_FILTER_OPTIONS = {
  categories: [],
  subcategories: [],
  catalogItems: [],
  warehouses: [],
  creators: [],
} as const satisfies {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  catalogItems: CatalogItemOption[];
  warehouses: WarehouseOption[];
  creators: UserOption[];
};

export { prDetailNeedsFilterOptions } from "@/lib/pr-access";

export const getFilterOptions = cache(async (): Promise<{
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  catalogItems: CatalogItemOption[];
  warehouses: WarehouseOption[];
  creators: UserOption[];
}> => {
  const [listOptions, catalogItems] = await dbParallel(
    () => getListFilterOptions(),
    () => getCachedActiveCatalogItems(),
  );

  return {
    ...listOptions,
    catalogItems,
  };
});

export async function getPurchaseRequests(
  user: SessionUser,
  filters: PurchaseRequestFilters,
): Promise<Paginated<PurchaseRequestListRow>> {
  const filterKey = stableFilterKey({
    role: user.role,
    warehouseId: user.warehouseId,
    warehouseIds: user.warehouseIds.join(","),
    userId: user.id,
    ...filters,
  });
  return cachedQuery(
    LIST_CACHE_TAGS.purchaseRequests,
    [filterKey],
    () => fetchPurchaseRequests(user, filters),
    { tags: [LIST_CACHE_TAGS.purchaseRequests] },
  );
}

async function fetchPurchaseRequests(
  user: SessionUser,
  filters: PurchaseRequestFilters,
): Promise<Paginated<PurchaseRequestListRow>> {
  const clauses: object[] = [];

  const assignedScope = warehouseScopeForUser(user);
  clauses.push(assignedScope);

  if (user.role === Role.SM) {
    clauses.push({ createdById: user.id });
  }

  if (filters.warehouseId) {
    clauses.push({ warehouseId: filters.warehouseId });
  }

  if (filters.statuses?.length) {
    clauses.push({ status: { in: filters.statuses } });
  }
  if (filters.categoryId) {
    clauses.push({
      lines: { some: { categoryId: filters.categoryId } },
    });
  }
  if (filters.subcategoryId) {
    clauses.push({
      lines: { some: { subcategoryId: filters.subcategoryId } },
    });
  }
  if (filters.executionType) {
    clauses.push({ executionType: filters.executionType });
  }
  if (filters.createdById) {
    clauses.push({ createdById: filters.createdById });
  }
  if (filters.dateFrom) {
    clauses.push({ createdAt: { gte: new Date(filters.dateFrom) } });
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    clauses.push({ createdAt: { lte: end } });
  }

  const where = clauses.length > 0 ? { AND: clauses } : {};
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const paginated = await paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount ?? false,
    count: () => prisma.purchaseRequest.count({ where }),
    findMany: ({ skip, take }) =>
      prisma.purchaseRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          quantity: true,
          executionType: true,
          status: true,
          currentVersion: true,
          createdAt: true,
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          lines: {
            orderBy: { lineNumber: "asc" },
            select: {
              quantity: true,
              category: { select: { name: true } },
              subcategory: { select: { name: true } },
              _count: { select: { items: true } },
              items: {
                select: {
                  poLineItem: { select: { id: true } },
                },
              },
            },
          },
          warehouse: { select: { name: true, location: true } },
          vendor: { select: { businessName: true } },
          vendorRequest: { select: { businessName: true, status: true } },
          createdBy: { select: { name: true } },
        },
      }),
  });

  return {
    ...paginated,
    items: paginated.items.map((pr) => {
      const lineRows = pr.lines.map((l) => ({
        subcategoryName: l.subcategory.name,
        categoryName: l.category.name,
        quantity: l.quantity ?? 0,
        catalogItemCount: l._count.items,
      }));
      const summary = formatLineSummary(lineRows);
      const totalQty =
        lineRows.length > 0 ? sumLineQuantities(lineRows) : (pr.quantity ?? 0);
      const primaryLine = pr.lines[0];
      const allItems = pr.lines.flatMap((l) => l.items);
      const poProgress =
        pr.executionType === ExecutionType.VENDOR_PURCHASE && allItems.length > 0
          ? {
              assigned: allItems.filter((i) => i.poLineItem).length,
              total: allItems.length,
            }
          : undefined;

      return {
        id: pr.id,
        categoryName: primaryLine?.category.name ?? pr.category?.name ?? "—",
        subcategoryName: primaryLine?.subcategory.name ?? pr.subcategory?.name ?? "—",
        lineSummary: summary.summary,
        lineCount: summary.lineCount || pr.lines.length,
        itemCount: summary.itemCount,
        warehouseName: formatWarehouseLabel(
          pr.warehouse.name,
          pr.warehouse.location,
        ),
        quantity: totalQty,
        vendorName:
          pr.executionType === ExecutionType.INTERNAL_PRINT
            ? null
            : (pr.vendor?.businessName ??
              (pr.vendorRequest?.status === "PENDING"
                ? `${pr.vendorRequest.businessName} (pending)`
                : pr.vendorRequest?.businessName) ??
              null),
        executionType: pr.executionType,
        status: pr.status,
        versionLabel: `V${pr.currentVersion}`,
        createdByName: pr.createdBy.name,
        createdAt: pr.createdAt.toISOString(),
        poProgress,
      };
    }),
  };
}

export async function getPRById(
  user: SessionUser,
  id: string,
): Promise<PRDetail | null> {
  return cachedQuery(
    LIST_CACHE_TAGS.prDetail,
    [id, user.role, user.warehouseId ?? "", user.warehouseIds.join(","), user.id],
    () => fetchPRById(user, id),
    { tags: [LIST_CACHE_TAGS.prDetail, `${LIST_CACHE_TAGS.prDetail}:${id}`] },
  );
}

async function fetchPRById(user: SessionUser, id: string): Promise<PRDetail | null> {
  return timed("query.fetchPRById", async () => {
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      lines: prLinesInclude,
      warehouse: { select: { name: true, location: true } },
      vendor: { select: { businessName: true } },
      vendorRequest: { select: { status: true, businessName: true } },
      createdBy: { select: { name: true } },
      versions: {
        orderBy: { changedAt: "desc" },
        select: {
          id: true,
          versionNumber: true,
          changedAt: true,
          revisionComment: true,
          diffSnapshot: true,
          changedBy: { select: { name: true } },
        },
      },
      purchaseOrders: {
        select: {
          id: true,
          status: true,
          orderedQty: true,
          createdAt: true,
          vendor: { select: { businessName: true } },
          lineItems: { select: { id: true } },
          invoices: {
            select: {
              createdAt: true,
              matchStatus: true,
              paymentStatus: true,
              payments: { select: { paidAt: true }, orderBy: { paidAt: "desc" }, take: 1 },
            },
            orderBy: { createdAt: "asc" },
          },
          grns: {
            select: { receivedAt: true },
            orderBy: { receivedAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      serialReservation: {
        select: {
          id: true,
          series: true,
          rangeStart: true,
          rangeEnd: true,
          quantity: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!pr) {
    return null;
  }

  if (!canViewPurchaseRequest(user, pr)) {
    return null;
  }

  const lines = mapPrLinesFromDb(pr.lines);
  const summary = formatLineSummary(lines);
  const totalQty = lines.length > 0 ? sumLineQuantities(lines) : (pr.quantity ?? 0);

  const primaryLine = lines[0];

  const revisionVersion = pr.versions.find((v) => {
    if (pr.status !== PRStatus.REVISION_REQUIRED) {
      return false;
    }
    const snap = v.diffSnapshot as { action?: string } | null;
    return snap?.action === "REVISION_REQUIRED" || Boolean(v.revisionComment);
  });

  const pos = pr.purchaseOrders;
  const allLineItems = pr.lines.flatMap((l) => l.items);
  const poProgress = {
    assigned: allLineItems.filter((i) => i.poLineItem).length,
    total: allLineItems.length,
  };
  const firstPo = pos[0] ?? null;
  const grnCount = pos.reduce((n, po) => n + po.grns.length, 0);
  const allInvoices = pos.flatMap((po) => po.invoices);
  const invoiceCount = allInvoices.length;
  const paidCount = allInvoices.filter((i) => i.paymentStatus === "PAID").length;

  const approvedVersion = pr.versions.find((v) => {
    const snap = v.diffSnapshot as { action?: string } | null;
    return snap?.action === "APPROVED";
  });

  const firstGrnAt =
    pos
      .flatMap((po) => po.grns)
      .map((g) => g.receivedAt)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const firstInvoiceAt =
    allInvoices
      .map((i) => i.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const allPaid =
    invoiceCount > 0 && paidCount === invoiceCount
      ? allInvoices
          .flatMap((i) => i.payments)
          .map((p) => p.paidAt)
          .filter((d): d is Date => d != null)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
      : null;

  return {
    id: pr.id,
    categoryId: primaryLine?.categoryId ?? pr.categoryId ?? "",
    categoryName: primaryLine?.categoryName ?? pr.category?.name ?? "—",
    subcategoryId: primaryLine?.subcategoryId ?? pr.subcategoryId ?? "",
    subcategoryName: primaryLine?.subcategoryName ?? pr.subcategory?.name ?? "—",
    lineSummary: summary.summary,
    lineCount: summary.lineCount || lines.length,
    itemCount: summary.itemCount || allLineItems.length || lines.length,
    quantity: totalQty,
    lines,
    warehouseId: pr.warehouseId,
    warehouseName: formatWarehouseLabel(pr.warehouse.name, pr.warehouse.location),
    vendorId: pr.vendorId,
    vendorName:
      pr.vendor?.businessName ??
      firstPo?.vendor?.businessName ??
      pr.vendorRequest?.businessName ??
      null,
    executionType: pr.executionType,
    status: pr.status,
    currentVersion: pr.currentVersion,
    revisionCount: pr.revisionCount,
    vendorRequestId: pr.vendorRequestId,
    vendorRequestStatus: pr.vendorRequest?.status ?? null,
    createdById: pr.createdById,
    createdByName: pr.createdBy.name,
    createdAt: pr.createdAt.toISOString(),
    updatedAt: pr.updatedAt.toISOString(),
    versions: pr.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      actionLabel: prVersionActionLabel(v.diffSnapshot),
      changedByName: v.changedBy.name,
      changedAt: v.changedAt.toISOString(),
      revisionComment: v.revisionComment,
    })),
    purchaseOrders: pos.map((po) => ({
      id: po.id,
      status: po.status,
      vendorName: po.vendor.businessName,
      createdAt: po.createdAt.toISOString(),
      itemCount: po.lineItems.length,
      orderedQty: po.orderedQty ?? 0,
      invoiceMatchStatus: aggregateInvoiceMatchStatus(po.invoices),
      paymentStatus: aggregatePaymentStatus(po.invoices),
    })),
    purchaseOrder: firstPo
      ? { id: firstPo.id, status: firstPo.status, createdAt: firstPo.createdAt.toISOString() }
      : null,
    poProgress,
    serialReservation: pr.serialReservation
      ? {
          id: pr.serialReservation.id,
          series: pr.serialReservation.series,
          rangeStart: pr.serialReservation.rangeStart.toString(),
          rangeEnd: pr.serialReservation.rangeEnd.toString(),
          quantity: pr.serialReservation.quantity,
          createdByName: pr.serialReservation.createdBy.name,
          createdAt: pr.serialReservation.createdAt.toISOString(),
        }
      : null,
    latestRevision: revisionVersion
      ? {
          comment: revisionVersion.revisionComment ?? "",
          byName: revisionVersion.changedBy.name,
          at: revisionVersion.changedAt.toISOString(),
        }
      : null,
    pendingCatalogItems: [],
    progress: {
      prApproved:
        pr.status === PRStatus.APPROVED ||
        pr.status === PRStatus.CONVERTED_TO_PO ||
        pr.status === PRStatus.EXECUTED_PRINT,
      prApprovedAt: approvedVersion?.changedAt.toISOString() ?? null,
      poCreated: pos.length > 0,
      poCreatedAt: firstPo?.createdAt.toISOString() ?? null,
      grnRecorded: grnCount > 0,
      grnRecordedAt: firstGrnAt?.toISOString() ?? null,
      invoiceUploaded: invoiceCount > 0,
      invoiceUploadedAt: firstInvoiceAt?.toISOString() ?? null,
      paymentReceived: paidCount > 0 && paidCount === invoiceCount && invoiceCount > 0,
      paymentReceivedAt: allPaid?.toISOString() ?? null,
    },
  };
  });
}
