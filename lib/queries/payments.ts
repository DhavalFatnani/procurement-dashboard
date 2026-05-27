import { InvoiceMatchStatus, PaymentStatus, type Prisma } from "@prisma/client";

import { getCachedActiveVendorOptions } from "@/lib/cache";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import {
  computeRemaining,
  deriveInvoicePaymentStatus,
  sumPaymentAmounts,
} from "@/lib/payment-totals";
import { prisma } from "@/lib/prisma";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { invoiceWhereFromScopeIds } from "@/lib/warehouse-scope";

export type PaymentFilters = {
  paymentStatus?: PaymentStatus;
  matchStatus?: InvoiceMatchStatus;
  vendorId?: string;
  poId?: string;
  scopeWarehouseIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

export type PaymentListRow = {
  invoiceId: string;
  invoiceNumber: string;
  poId: string;
  vendorName: string;
  vendorUpdatedAfterPo: boolean;
  vendorUpdatedAt: string | null;
  vendorIfsc: string;
  invoiceAmount: string;
  expectedAmount: string | null;
  paidTotal: string;
  remaining: string;
  matchStatus: InvoiceMatchStatus;
  paymentStatus: PaymentStatus;
  method: string | null;
  transactionRef: string | null;
  paidByName: string | null;
  paidAt: string | null;
  uploadedByName: string;
  grnReceiptDates: string[];
};

export type PaymentEntry = {
  id: string;
  amount: string;
  method: string | null;
  transactionRef: string | null;
  paidAt: string | null;
  paidByName: string | null;
  proofSignedUrl: string | null;
};

export type InvoicePaymentDetail = {
  invoiceId: string;
  poId: string;
  prId: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: string;
  paidTotal: string;
  remaining: string;
  expectedAmount: string | null;
  matchStatus: InvoiceMatchStatus;
  paymentStatus: PaymentStatus;
  overrideReason: string | null;
  variance: number | null;
  variancePct: number | null;
  uploadedByName: string;
  createdAt: string;
  fileUrl: string;
  fileSignedUrl: string | null;
  grns: {
    id: string;
    receivedAt: string;
    acceptedQty: number;
    disputedQty: number;
  }[];
  payments: PaymentEntry[];
  vendorBank: {
    accountName: string;
    accountLast4: string;
    ifsc: string;
    bankName: string;
  };
};

export async function getPayments(
  filters: PaymentFilters,
): Promise<Paginated<PaymentListRow>> {
  const filterKey = stableFilterKey({ ...filters });
  return cachedQuery(
    LIST_CACHE_TAGS.payments,
    [filterKey],
    () => fetchPayments(filters),
    { tags: [LIST_CACHE_TAGS.payments] },
  );
}

async function fetchPayments(
  filters: PaymentFilters,
): Promise<Paginated<PaymentListRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const clauses: Prisma.InvoiceWhereInput[] = [];
  if (filters.scopeWarehouseIds !== undefined) {
    clauses.push(invoiceWhereFromScopeIds(filters.scopeWarehouseIds));
  }
  if (filters.paymentStatus) {
    clauses.push({ paymentStatus: filters.paymentStatus });
  }
  if (filters.matchStatus) {
    clauses.push({ matchStatus: filters.matchStatus });
  }
  if (filters.vendorId) {
    clauses.push({ purchaseOrder: { vendorId: filters.vendorId } });
  }
  if (filters.poId) {
    clauses.push({ poId: filters.poId });
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
          uploadedBy: { select: { name: true } },
          grnLinks: { select: { grn: { select: { receivedAt: true } } } },
          purchaseOrder: {
            select: {
              createdAt: true,
              vendor: {
                select: {
                  businessName: true,
                  updatedAt: true,
                  ifsc: true,
                },
              },
            },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            select: {
              amount: true,
              method: true,
              transactionRef: true,
              paidAt: true,
              paidBy: { select: { name: true } },
            },
          },
        },
      }).then((rows) =>
        rows.map((r) => {
          const invoiceAmount = Number(r.amount);
          const paidTotal = sumPaymentAmounts(r.payments);
          const remaining = computeRemaining(invoiceAmount, paidTotal);
          const latest =
            r.payments.find((p) => p.amount != null) ?? r.payments[0];
          const vendor = r.purchaseOrder.vendor;
          const vendorUpdatedAfterPo = vendor.updatedAt > r.purchaseOrder.createdAt;
          return {
            invoiceId: r.id,
            invoiceNumber: r.invoiceNumber,
            poId: r.poId,
            vendorName: vendor.businessName,
            vendorUpdatedAfterPo,
            vendorUpdatedAt: vendorUpdatedAfterPo ? vendor.updatedAt.toISOString() : null,
            vendorIfsc: vendor.ifsc,
            invoiceAmount: r.amount.toString(),
            expectedAmount: r.expectedAmount?.toString() ?? null,
            paidTotal: paidTotal.toString(),
            remaining: remaining.toString(),
            matchStatus: r.matchStatus,
            paymentStatus: r.paymentStatus,
            method: latest?.method ?? null,
            transactionRef: latest?.transactionRef ?? null,
            paidByName: latest?.paidBy?.name ?? null,
            paidAt: latest?.paidAt?.toISOString() ?? null,
            uploadedByName: r.uploadedBy.name,
            grnReceiptDates: r.grnLinks.map((l) =>
              l.grn.receivedAt.toISOString(),
            ),
          };
        }),
      ),
    count: () => prisma.invoice.count({ where }),
  });
}

export async function getPaymentFilterOptions() {
  const vendors = await getCachedActiveVendorOptions();
  return { vendors };
}

export async function getInvoicePaymentDetail(
  invoiceId: string,
): Promise<InvoicePaymentDetail | null> {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      uploadedBy: { select: { name: true } },
      purchaseOrder: {
        select: {
          prId: true,
          vendor: {
            select: {
              businessName: true,
              accountName: true,
              accountNumber: true,
              ifsc: true,
              bankName: true,
            },
          },
        },
      },
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
      payments: {
        where: { amount: { not: null } },
        orderBy: { createdAt: "desc" },
        include: { paidBy: { select: { name: true } } },
      },
    },
  });

  if (!inv) {
    return null;
  }

  const invoiceAmount = Number(inv.amount);
  const paidTotal = sumPaymentAmounts(inv.payments);
  const remaining = computeRemaining(invoiceAmount, paidTotal);
  const expected = inv.expectedAmount != null ? Number(inv.expectedAmount) : null;
  const variance = expected != null ? invoiceAmount - expected : null;
  const variancePct =
    expected != null && expected > 0 ? ((invoiceAmount - expected) / expected) * 100 : null;

  const { createStorageSignedUrl } = await import("@/lib/upload-storage");
  const [payments, fileSignedUrl] = await Promise.all([
    Promise.all(
      inv.payments.map(async (payment) => ({
        id: payment.id,
        amount: payment.amount!.toString(),
        method: payment.method,
        transactionRef: payment.transactionRef,
        paidAt: payment.paidAt?.toISOString() ?? null,
        paidByName: payment.paidBy?.name ?? null,
        proofSignedUrl: payment.proofUrl
          ? await createStorageSignedUrl(
              STORAGE_BUCKETS.paymentProofs,
              payment.proofUrl,
            )
          : null,
      })),
    ),
    createStorageSignedUrl(STORAGE_BUCKETS.invoices, inv.fileUrl),
  ]);

  const vendor = inv.purchaseOrder.vendor;
  const acct = vendor.accountNumber;
  const last4 = acct.length >= 4 ? acct.slice(-4) : acct;

  return {
    invoiceId: inv.id,
    poId: inv.poId,
    prId: inv.purchaseOrder.prId,
    vendorName: vendor.businessName,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate.toISOString(),
    amount: inv.amount.toString(),
    paidTotal: paidTotal.toString(),
    remaining: remaining.toString(),
    expectedAmount: inv.expectedAmount?.toString() ?? null,
    matchStatus: inv.matchStatus,
    paymentStatus: inv.paymentStatus,
    overrideReason: inv.overrideReason,
    variance,
    variancePct,
    uploadedByName: inv.uploadedBy.name,
    createdAt: inv.createdAt.toISOString(),
    fileUrl: inv.fileUrl,
    fileSignedUrl,
    grns: inv.grnLinks.map((l) => ({
      id: l.grn.id,
      receivedAt: l.grn.receivedAt.toISOString(),
      acceptedQty: l.grn.acceptedQty,
      disputedQty: l.grn.disputedQty,
    })),
    payments,
    vendorBank: {
      accountName: vendor.accountName,
      accountLast4: last4,
      ifsc: vendor.ifsc,
      bankName: vendor.bankName,
    },
  };
}
