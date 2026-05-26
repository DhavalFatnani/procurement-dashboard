import {
  InvoiceMatchStatus,
  PaymentStatus,
  POStatus,
  type Prisma,
} from "@prisma/client";

import { getCachedActiveVendorOptions } from "@/lib/cache";
import { formatProcurementRef } from "@/lib/display-ref";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { STORAGE_BUCKETS } from "@/lib/storage";

export type InvoiceFilters = {
  matchStatus?: InvoiceMatchStatus;
  paymentStatus?: PaymentStatus;
  vendorId?: string;
  poId?: string;
  scopeWarehouseIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  uploadedById?: string;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

export type InvoiceListRow = {
  id: string;
  invoiceNumber: string;
  poId: string;
  vendorName: string;
  grnReceiptDates: string[];
  amount: string;
  expectedAmount: string | null;
  matchStatus: InvoiceMatchStatus;
  paymentStatus: PaymentStatus;
  uploadedByName: string;
  createdAt: string;
};

export type POForInvoiceOption = {
  id: string;
  label: string;
  vendorName: string;
  unitPrice: string | null;
  linePrices: { poLineId: string; label: string; unitPrice: string }[];
  grns: InvoiceGRNOption[];
};

export type InvoiceGRNOption = {
  id: string;
  receivedAt: string;
  acceptedQty: number;
  disputedQty: number;
  alreadyInvoiced: boolean;
  lineAccepted: { poLineId: string; acceptedQty: number }[];
};

export type InvoiceDetail = {
  id: string;
  poId: string;
  prId: string;
  vendorName: string;
  invoiceNumber: string;
  amount: string;
  expectedAmount: string | null;
  matchStatus: InvoiceMatchStatus;
  paymentStatus: PaymentStatus;
  invoiceDate: string;
  fileUrl: string;
  fileSignedUrl: string | null;
  tolerancePct: string;
  overrideReason: string | null;
  uploadedByName: string;
  createdAt: string;
  grns: {
    id: string;
    receivedAt: string;
    acceptedQty: number;
    disputedQty: number;
  }[];
  variance: number | null;
  variancePct: number | null;
};

export async function getInvoices(
  filters: InvoiceFilters,
): Promise<Paginated<InvoiceListRow>> {
  const filterKey = stableFilterKey({ ...filters });
  return cachedQuery(
    LIST_CACHE_TAGS.invoices,
    [filterKey],
    () => fetchInvoices(filters),
    { tags: [LIST_CACHE_TAGS.invoices] },
  );
}

async function fetchInvoices(
  filters: InvoiceFilters,
): Promise<Paginated<InvoiceListRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const clauses: Prisma.InvoiceWhereInput[] = [];
  if (filters.scopeWarehouseIds?.length) {
    const ids = filters.scopeWarehouseIds;
    clauses.push({
      purchaseOrder: {
        purchaseRequest: {
          warehouseId: ids.length === 1 ? ids[0]! : { in: ids },
        },
      },
    });
  }
  if (filters.matchStatus) {
    clauses.push({ matchStatus: filters.matchStatus });
  }
  if (filters.paymentStatus) {
    clauses.push({ paymentStatus: filters.paymentStatus });
  }
  if (filters.vendorId) {
    clauses.push({ purchaseOrder: { vendorId: filters.vendorId } });
  }
  if (filters.poId) {
    clauses.push({ poId: filters.poId });
  }
  if (filters.uploadedById) {
    clauses.push({ uploadedById: filters.uploadedById });
  }
  if (filters.dateFrom) {
    clauses.push({ createdAt: { gte: new Date(filters.dateFrom) } });
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    clauses.push({ createdAt: { lte: end } });
  }

  const where: Prisma.InvoiceWhereInput =
    clauses.length > 0 ? { AND: clauses } : {};

  return paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount,
    findMany: ({ skip, take }) =>
      prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          poId: true,
          amount: true,
          expectedAmount: true,
          matchStatus: true,
          paymentStatus: true,
          createdAt: true,
          purchaseOrder: {
            select: { vendor: { select: { businessName: true } } },
          },
          uploadedBy: { select: { name: true } },
          grnLinks: { select: { grn: { select: { receivedAt: true } } } },
        },
      }).then((rows) =>
        rows.map((r) => ({
          id: r.id,
          invoiceNumber: r.invoiceNumber,
          poId: r.poId,
          vendorName: r.purchaseOrder.vendor.businessName,
          grnReceiptDates: r.grnLinks.map((l) => l.grn.receivedAt.toISOString()),
          amount: r.amount.toString(),
          expectedAmount: r.expectedAmount?.toString() ?? null,
          matchStatus: r.matchStatus,
          paymentStatus: r.paymentStatus,
          uploadedByName: r.uploadedBy.name,
          createdAt: r.createdAt.toISOString(),
        })),
      ),
    count: () => prisma.invoice.count({ where }),
  });
}

export async function getInvoiceFilterOptions() {
  const vendors = await getCachedActiveVendorOptions();
  return { vendors };
}

export async function getInvoiceById(id: string): Promise<InvoiceDetail | null> {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      purchaseOrder: {
        select: {
          prId: true,
          vendor: { select: { businessName: true } },
        },
      },
      uploadedBy: { select: { name: true } },
      grnLinks: {
        select: {
          grn: {
            select: {
              id: true,
              receivedAt: true,
              acceptedQty: true,
              disputedQty: true,
            },
          },
        },
      },
    },
  });

  if (!inv) {
    return null;
  }

  const amount = Number(inv.amount);
  const expected = inv.expectedAmount != null ? Number(inv.expectedAmount) : null;
  const variance = expected != null ? amount - expected : null;
  const variancePct =
    expected != null && expected > 0 ? ((amount - expected) / expected) * 100 : null;

  const { createStorageSignedUrl } = await import("@/lib/upload-storage");

  return {
    id: inv.id,
    poId: inv.poId,
    prId: inv.purchaseOrder.prId,
    vendorName: inv.purchaseOrder.vendor.businessName,
    invoiceNumber: inv.invoiceNumber,
    amount: inv.amount.toString(),
    expectedAmount: inv.expectedAmount?.toString() ?? null,
    matchStatus: inv.matchStatus,
    paymentStatus: inv.paymentStatus,
    invoiceDate: inv.invoiceDate.toISOString(),
    fileUrl: inv.fileUrl,
    fileSignedUrl: await createStorageSignedUrl(STORAGE_BUCKETS.invoices, inv.fileUrl),
    tolerancePct: inv.tolerancePct.toString(),
    overrideReason: inv.overrideReason,
    uploadedByName: inv.uploadedBy.name,
    createdAt: inv.createdAt.toISOString(),
    grns: inv.grnLinks.map((l) => ({
      id: l.grn.id,
      receivedAt: l.grn.receivedAt.toISOString(),
      acceptedQty: l.grn.acceptedQty,
      disputedQty: l.grn.disputedQty,
    })),
    variance,
    variancePct,
  };
}

export async function searchPOsForInvoice(
  q: string,
  limit = 20,
): Promise<Pick<POForInvoiceOption, "id" | "label" | "vendorName">[]> {
  const trimmed = q.trim();
  const where: Prisma.PurchaseOrderWhereInput = {
    status: {
      in: [
        POStatus.OPEN,
        POStatus.PARTIALLY_RECEIVED,
        POStatus.FULLY_RECEIVED,
        POStatus.INVOICED,
        POStatus.PAID,
        POStatus.PARTIALLY_CLOSED,
      ],
    },
    grns: { some: { acceptedQty: { gt: 0 } } },
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
    select: {
      id: true,
      vendor: { select: { businessName: true } },
    },
  });

  return pos.map((po) => ({
    id: po.id,
    label: `${formatProcurementRef(po.id)} · ${po.vendor.businessName}`,
    vendorName: po.vendor.businessName,
  }));
}

export async function getPOForInvoiceById(poId: string): Promise<POForInvoiceOption | null> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: {
      id: true,
      unitPrice: true,
      vendor: { select: { businessName: true } },
      lineItems: {
        orderBy: [{ categoryId: "asc" }, { subcategoryId: "asc" }],
        select: {
          id: true,
          unitPrice: true,
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          catalogItem: { select: { name: true } },
        },
      },
      lines: {
        orderBy: { prLine: { lineNumber: "asc" } },
        select: {
          id: true,
          unitPrice: true,
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
        },
      },
      grns: {
        where: { acceptedQty: { gt: 0 } },
        select: {
          id: true,
          receivedAt: true,
          acceptedQty: true,
          disputedQty: true,
          invoiceLinks: { select: { id: true } },
          lineItems: { select: { poLineItemId: true, acceptedQty: true } },
          lines: { select: { poLineId: true, acceptedQty: true } },
        },
      },
    },
  });

  if (!po) {
    return null;
  }

  const eligible = po.grns.filter((g) => g.invoiceLinks.length === 0);
  if (eligible.length === 0) {
    return null;
  }

  const linePrices =
    po.lineItems.length > 0
      ? po.lineItems.map((line) => ({
          poLineId: line.id,
          label: `${line.category.name} / ${line.subcategory.name} · ${line.catalogItem.name}`,
          unitPrice: line.unitPrice.toString(),
        }))
      : po.lines.map((line) => ({
          poLineId: line.id,
          label: `${line.category.name} / ${line.subcategory.name}`,
          unitPrice: line.unitPrice.toString(),
        }));

  return {
    id: po.id,
    label: `${formatProcurementRef(po.id)} · ${po.vendor.businessName}`,
    vendorName: po.vendor.businessName,
    unitPrice:
      linePrices.length === 1
        ? linePrices[0]!.unitPrice
        : (po.unitPrice?.toString() ?? null),
    linePrices,
    grns: po.grns.map((g) => ({
      id: g.id,
      receivedAt: g.receivedAt.toISOString(),
      acceptedQty: g.acceptedQty,
      disputedQty: g.disputedQty,
      alreadyInvoiced: g.invoiceLinks.length > 0,
      lineAccepted:
        g.lineItems.length > 0
          ? g.lineItems.map((l) => ({
              poLineId: l.poLineItemId,
              acceptedQty: l.acceptedQty,
            }))
          : g.lines.map((l) => ({
              poLineId: l.poLineId,
              acceptedQty: l.acceptedQty,
            })),
    })),
  };
}

/** @deprecated Prefer searchPOsForInvoice — loads all eligible POs. */
export async function getPOsForInvoice(): Promise<POForInvoiceOption[]> {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      status: {
        in: [
          POStatus.OPEN,
          POStatus.PARTIALLY_RECEIVED,
          POStatus.FULLY_RECEIVED,
          POStatus.INVOICED,
          POStatus.PAID,
          POStatus.PARTIALLY_CLOSED,
        ],
      },
      grns: { some: { acceptedQty: { gt: 0 } } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      unitPrice: true,
      vendor: { select: { businessName: true } },
      grns: {
        where: { acceptedQty: { gt: 0 } },
        select: {
          id: true,
          receivedAt: true,
          acceptedQty: true,
          disputedQty: true,
          invoiceLinks: { select: { id: true } },
          lines: { select: { poLineId: true, acceptedQty: true } },
        },
      },
      lines: {
        orderBy: { prLine: { lineNumber: "asc" } },
        select: {
          id: true,
          unitPrice: true,
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
        },
      },
    },
  });

  return pos
    .map((po) => {
      const eligible = po.grns.filter((g) => g.invoiceLinks.length === 0);
      if (eligible.length === 0) {
        return null;
      }
      return {
        id: po.id,
        label: `${formatProcurementRef(po.id)} · ${po.vendor.businessName}`,
        vendorName: po.vendor.businessName,
        unitPrice:
          po.lines.length === 1
            ? po.lines[0]!.unitPrice.toString()
            : (po.unitPrice?.toString() ?? null),
        linePrices: po.lines.map((line) => ({
          poLineId: line.id,
          label: `${line.category.name} / ${line.subcategory.name}`,
          unitPrice: line.unitPrice.toString(),
        })),
        grns: po.grns.map((g) => ({
          id: g.id,
          receivedAt: g.receivedAt.toISOString(),
          acceptedQty: g.acceptedQty,
          disputedQty: g.disputedQty,
          alreadyInvoiced: g.invoiceLinks.length > 0,
          lineAccepted: g.lines.map((l) => ({
            poLineId: l.poLineId,
            acceptedQty: l.acceptedQty,
          })),
        })),
      };
    })
    .filter((p): p is POForInvoiceOption => p != null);
}

export async function getGRNsForPO(poId: string): Promise<InvoiceGRNOption[]> {
  const grns = await prisma.goodsReceipt.findMany({
    where: { poId, acceptedQty: { gt: 0 } },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      receivedAt: true,
      acceptedQty: true,
      disputedQty: true,
      invoiceLinks: { select: { id: true } },
      lines: { select: { poLineId: true, acceptedQty: true } },
    },
  });

  return grns.map((g) => ({
    id: g.id,
    receivedAt: g.receivedAt.toISOString(),
    acceptedQty: g.acceptedQty,
    disputedQty: g.disputedQty,
    alreadyInvoiced: g.invoiceLinks.length > 0,
    lineAccepted: g.lines.map((l) => ({
      poLineId: l.poLineId,
      acceptedQty: l.acceptedQty,
    })),
  }));
}
