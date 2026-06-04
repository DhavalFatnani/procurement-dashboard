import "server-only";

import {
  InvoiceMatchStatus,
  PaymentStatus,
  POAdvanceRequestStatus,
  type Prisma,
} from "@/lib/prisma-client";

import { getCachedActiveVendorOptions } from "@/lib/cache";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import { paginatedListQuery, toPaginated, type Paginated } from "@/lib/pagination";
import {
  computeAdvanceBalances,
  invoiceRemainingBeforeCash,
  suggestAdvanceAllocation,
  sumAllocationsForInvoice,
  sumCashPaidForInvoice,
} from "@/lib/po-advance";
import { computeRemainingSettled } from "@/lib/payment-totals";
import {
  deriveSettlementComposition,
  type SettlementComposition,
} from "@/lib/settlement-helpers";
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
  cashPaidOnInvoice: string;
  advanceAllocatedOnInvoice: string;
  remaining: string;
  advanceUnallocatedOnPo: string;
  hasPendingAdvanceRequest: boolean;
  settledVia: SettlementComposition;
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

export type PaymentRegisterFilters = {
  vendorId?: string;
  poId?: string;
  type?: "cash" | "advance" | "";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
  scopeWarehouseIds?: string[];
};

export type PaymentRegisterRow = {
  id: string;
  kind: "cash" | "advance";
  amount: string;
  date: string;
  invoiceId: string;
  invoiceNumber: string;
  poId: string;
  vendorName: string;
  transactionRef: string | null;
  method: string | null;
  recordedByName: string | null;
  href: string;
};

export type CashPaymentDetail = {
  id: string;
  amount: string;
  method: string | null;
  transactionRef: string | null;
  paidAt: string | null;
  paidByName: string | null;
  proofSignedUrl: string | null;
  status: PaymentStatus;
  createdAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: string;
    paymentStatus: PaymentStatus;
    cashPaidOnInvoice: string;
    advanceAllocatedOnInvoice: string;
    remaining: string;
  };
  poId: string;
  prId: string;
  vendorName: string;
  vendorBank: {
    accountName: string;
    accountNumber: string;
    accountLast4: string;
    ifsc: string;
    bankName: string;
  };
};

export type AdvanceAllocationDetail = {
  id: string;
  amount: string;
  createdAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: string;
    paymentStatus: PaymentStatus;
    cashPaidOnInvoice: string;
    advanceAllocatedOnInvoice: string;
    remaining: string;
  };
  advancePayment: {
    id: string;
    amount: string;
    paidAt: string;
    method: string | null;
    transactionRef: string;
    paidByName: string;
    unallocatedOnPo: string;
  };
  poId: string;
  prId: string;
  vendorName: string;
};

export type AdvanceAllocationEntry = {
  id: string;
  amount: string;
  createdAt: string;
  advancePaymentId: string;
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
  cashPaidOnInvoice: string;
  advanceAllocated: string;
  remaining: string;
  advanceUnallocatedOnPo: string;
  suggestedAdvanceAllocation: string;
  advanceAllocations: AdvanceAllocationEntry[];
  pendingAdvanceRequestCount: number;
  pendingAdvanceRequestTotal: string;
  firstPendingAdvanceRequestId: string | null;
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
    accountNumber: string;
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
          advanceAllocations: { select: { amount: true } },
          purchaseOrder: {
            select: {
              createdAt: true,
              advancePayments: {
                include: { allocations: { select: { amount: true } } },
              },
              advanceRequests: {
                where: { status: POAdvanceRequestStatus.PENDING },
                select: { id: true, requestedAmount: true },
              },
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
          const cashPaidOnInvoice = sumCashPaidForInvoice(r);
          const advanceAllocatedOnInvoice = sumAllocationsForInvoice(r);
          const paidTotal = cashPaidOnInvoice + advanceAllocatedOnInvoice;
          const remaining = computeRemainingSettled(
            invoiceAmount,
            cashPaidOnInvoice,
            advanceAllocatedOnInvoice,
          );
          const { advanceUnallocated } = computeAdvanceBalances(
            r.purchaseOrder.advancePayments,
          );
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
            cashPaidOnInvoice: cashPaidOnInvoice.toString(),
            advanceAllocatedOnInvoice: advanceAllocatedOnInvoice.toString(),
            remaining: remaining.toString(),
            advanceUnallocatedOnPo: advanceUnallocated.toString(),
            hasPendingAdvanceRequest: r.purchaseOrder.advanceRequests.length > 0,
            settledVia: deriveSettlementComposition(
              advanceAllocatedOnInvoice,
              cashPaidOnInvoice,
            ),
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
      advanceAllocations: {
        select: {
          id: true,
          amount: true,
          createdAt: true,
          advancePaymentId: true,
        },
        orderBy: { createdAt: "desc" },
      },
      purchaseOrder: {
        select: {
          prId: true,
          advanceRequests: {
            where: { status: POAdvanceRequestStatus.PENDING },
            select: { id: true, requestedAmount: true },
            orderBy: { requestedAt: "asc" },
          },
          vendor: {
            select: {
              businessName: true,
              accountName: true,
              accountNumber: true,
              ifsc: true,
              bankName: true,
            },
          },
          advancePayments: {
            include: { allocations: { select: { amount: true } } },
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
  const cashPaid = sumCashPaidForInvoice(inv);
  const advanceAllocated = sumAllocationsForInvoice(inv);
  const paidTotal = cashPaid + advanceAllocated;
  const remaining = invoiceRemainingBeforeCash(inv);
  const { advanceUnallocated } = computeAdvanceBalances(
    inv.purchaseOrder.advancePayments,
  );
  const suggestedAdvanceAllocation = suggestAdvanceAllocation(
    advanceUnallocated,
    remaining,
  );
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

  const pendingRequests = inv.purchaseOrder.advanceRequests;
  const pendingAdvanceRequestTotal = pendingRequests.reduce(
    (sum, req) => sum + Number(req.requestedAmount),
    0,
  );

  return {
    invoiceId: inv.id,
    poId: inv.poId,
    prId: inv.purchaseOrder.prId,
    vendorName: vendor.businessName,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate.toISOString(),
    amount: inv.amount.toString(),
    paidTotal: paidTotal.toString(),
    cashPaidOnInvoice: cashPaid.toString(),
    advanceAllocated: advanceAllocated.toString(),
    remaining: remaining.toString(),
    advanceUnallocatedOnPo: advanceUnallocated.toString(),
    suggestedAdvanceAllocation: suggestedAdvanceAllocation.toString(),
    advanceAllocations: inv.advanceAllocations.map((a) => ({
      id: a.id,
      amount: a.amount.toString(),
      createdAt: a.createdAt.toISOString(),
      advancePaymentId: a.advancePaymentId,
    })),
    pendingAdvanceRequestCount: pendingRequests.length,
    pendingAdvanceRequestTotal: pendingAdvanceRequestTotal.toString(),
    firstPendingAdvanceRequestId: pendingRequests[0]?.id ?? null,
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
      accountNumber: acct,
      accountLast4: last4,
      ifsc: vendor.ifsc,
      bankName: vendor.bankName,
    },
  };
}

function endOfDay(dateStr: string): Date {
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return end;
}

function cashPaymentRegisterDate(payment: {
  paidAt: Date | null;
  createdAt: Date;
}): Date {
  return payment.paidAt ?? payment.createdAt;
}

function buildInvoiceScopeForRegister(
  filters: PaymentRegisterFilters,
): Prisma.InvoiceWhereInput {
  const clauses: Prisma.InvoiceWhereInput[] = [];
  if (filters.scopeWarehouseIds !== undefined) {
    clauses.push(invoiceWhereFromScopeIds(filters.scopeWarehouseIds));
  }
  if (filters.vendorId) {
    clauses.push({ purchaseOrder: { vendorId: filters.vendorId } });
  }
  if (filters.poId) {
    clauses.push({ poId: filters.poId });
  }
  return clauses.length > 0 ? { AND: clauses } : {};
}

function buildCashPaymentDateWhere(
  dateFrom?: string,
  dateTo?: string,
): Prisma.PaymentWhereInput | undefined {
  if (!dateFrom && !dateTo) {
    return undefined;
  }
  const paidAtRange: Prisma.DateTimeNullableFilter = {};
  const createdAtRange: Prisma.DateTimeFilter = {};
  if (dateFrom) {
    const from = new Date(dateFrom);
    paidAtRange.gte = from;
    createdAtRange.gte = from;
  }
  if (dateTo) {
    const to = endOfDay(dateTo);
    paidAtRange.lte = to;
    createdAtRange.lte = to;
  }
  return {
    OR: [
      { paidAt: paidAtRange },
      { paidAt: null, createdAt: createdAtRange },
    ],
  };
}

function buildAllocationDateWhere(
  dateFrom?: string,
  dateTo?: string,
): Prisma.POAdvanceAllocationWhereInput | undefined {
  if (!dateFrom && !dateTo) {
    return undefined;
  }
  const createdAt: Prisma.DateTimeFilter = {};
  if (dateFrom) {
    createdAt.gte = new Date(dateFrom);
  }
  if (dateTo) {
    createdAt.lte = endOfDay(dateTo);
  }
  return { createdAt };
}

export async function getPaymentRegister(
  filters: PaymentRegisterFilters,
): Promise<Paginated<PaymentRegisterRow>> {
  const filterKey = stableFilterKey({ ...filters, query: "register" });
  return cachedQuery(
    LIST_CACHE_TAGS.payments,
    [filterKey],
    () => fetchPaymentRegister(filters),
    { tags: [LIST_CACHE_TAGS.payments] },
  );
}

async function fetchPaymentRegister(
  filters: PaymentRegisterFilters,
): Promise<Paginated<PaymentRegisterRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const type = filters.type ?? "";
  const invoiceScope = buildInvoiceScopeForRegister(filters);
  const includeCash = type !== "advance";
  const includeAdvance = type !== "cash";

  const [cashRows, advanceRows] = await Promise.all([
    includeCash
      ? prisma.payment.findMany({
          where: {
            amount: { not: null },
            invoice: invoiceScope,
            ...(buildCashPaymentDateWhere(filters.dateFrom, filters.dateTo) ?? {}),
          },
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            amount: true,
            method: true,
            transactionRef: true,
            paidAt: true,
            createdAt: true,
            paidBy: { select: { name: true } },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                poId: true,
                purchaseOrder: {
                  select: {
                    vendor: { select: { businessName: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    includeAdvance
      ? prisma.pOAdvanceAllocation.findMany({
          where: {
            invoice: invoiceScope,
            ...(buildAllocationDateWhere(filters.dateFrom, filters.dateTo) ?? {}),
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amount: true,
            createdAt: true,
            advancePayment: {
              select: {
                method: true,
                transactionRef: true,
                paidBy: { select: { name: true } },
              },
            },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                poId: true,
                purchaseOrder: {
                  select: {
                    vendor: { select: { businessName: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const merged: PaymentRegisterRow[] = [
    ...cashRows.map((row) => ({
      id: row.id,
      kind: "cash" as const,
      amount: row.amount!.toString(),
      date: cashPaymentRegisterDate(row).toISOString(),
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      poId: row.invoice.poId,
      vendorName: row.invoice.purchaseOrder.vendor.businessName,
      transactionRef: row.transactionRef,
      method: row.method,
      recordedByName: row.paidBy?.name ?? null,
      href: FINANCE_ROUTES.cashPaymentDetail(row.id),
    })),
    ...advanceRows.map((row) => ({
      id: row.id,
      kind: "advance" as const,
      amount: row.amount.toString(),
      date: row.createdAt.toISOString(),
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      poId: row.invoice.poId,
      vendorName: row.invoice.purchaseOrder.vendor.businessName,
      transactionRef: row.advancePayment.transactionRef,
      method: row.advancePayment.method,
      recordedByName: row.advancePayment.paidBy.name,
      href: FINANCE_ROUTES.allocationDetail(row.id),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const skip = (page - 1) * pageSize;
  const items = merged.slice(skip, skip + pageSize);

  if (filters.includeExactCount) {
    return toPaginated(items, merged.length, page, pageSize);
  }

  const hasNextPage = skip + pageSize < merged.length;
  const estimatedTotal = hasNextPage ? page * pageSize + 1 : skip + items.length;

  return {
    items,
    total: estimatedTotal,
    page,
    pageSize,
    totalPages: hasNextPage ? page + 1 : page,
    hasNextPage,
  };
}

export async function getCashPaymentDetail(
  paymentId: string,
): Promise<CashPaymentDetail | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      paidBy: { select: { name: true } },
      invoice: {
        include: {
          advanceAllocations: { select: { amount: true } },
          payments: { select: { amount: true } },
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
        },
      },
    },
  });

  if (!payment || payment.amount == null) {
    return null;
  }

  const invoiceAmount = Number(payment.invoice.amount);
  const cashPaidOnInvoice = sumCashPaidForInvoice(payment.invoice);
  const advanceAllocatedOnInvoice = sumAllocationsForInvoice(payment.invoice);
  const remaining = computeRemainingSettled(
    invoiceAmount,
    cashPaidOnInvoice,
    advanceAllocatedOnInvoice,
  );

  const { createStorageSignedUrl } = await import("@/lib/upload-storage");
  const proofSignedUrl = payment.proofUrl
    ? await createStorageSignedUrl(STORAGE_BUCKETS.paymentProofs, payment.proofUrl)
    : null;

  const vendor = payment.invoice.purchaseOrder.vendor;
  const acct = vendor.accountNumber;
  const last4 = acct.length >= 4 ? acct.slice(-4) : acct;

  return {
    id: payment.id,
    amount: payment.amount.toString(),
    method: payment.method,
    transactionRef: payment.transactionRef,
    paidAt: payment.paidAt?.toISOString() ?? null,
    paidByName: payment.paidBy?.name ?? null,
    proofSignedUrl,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
    invoice: {
      id: payment.invoice.id,
      invoiceNumber: payment.invoice.invoiceNumber,
      amount: payment.invoice.amount.toString(),
      paymentStatus: payment.invoice.paymentStatus,
      cashPaidOnInvoice: cashPaidOnInvoice.toString(),
      advanceAllocatedOnInvoice: advanceAllocatedOnInvoice.toString(),
      remaining: remaining.toString(),
    },
    poId: payment.invoice.poId,
    prId: payment.invoice.purchaseOrder.prId,
    vendorName: vendor.businessName,
    vendorBank: {
      accountName: vendor.accountName,
      accountNumber: acct,
      accountLast4: last4,
      ifsc: vendor.ifsc,
      bankName: vendor.bankName,
    },
  };
}

export async function getAdvanceAllocationDetail(
  allocationId: string,
): Promise<AdvanceAllocationDetail | null> {
  const allocation = await prisma.pOAdvanceAllocation.findUnique({
    where: { id: allocationId },
    include: {
      invoice: {
        include: {
          advanceAllocations: { select: { amount: true } },
          payments: { select: { amount: true } },
          purchaseOrder: {
            select: {
              prId: true,
              vendor: { select: { businessName: true } },
              advancePayments: {
                include: { allocations: { select: { amount: true } } },
              },
            },
          },
        },
      },
      advancePayment: {
        include: {
          paidBy: { select: { name: true } },
          allocations: { select: { amount: true } },
        },
      },
    },
  });

  if (!allocation) {
    return null;
  }

  const invoiceAmount = Number(allocation.invoice.amount);
  const cashPaidOnInvoice = sumCashPaidForInvoice(allocation.invoice);
  const advanceAllocatedOnInvoice = sumAllocationsForInvoice(allocation.invoice);
  const remaining = computeRemainingSettled(
    invoiceAmount,
    cashPaidOnInvoice,
    advanceAllocatedOnInvoice,
  );

  const { advanceUnallocated } = computeAdvanceBalances(
    allocation.invoice.purchaseOrder.advancePayments,
  );

  return {
    id: allocation.id,
    amount: allocation.amount.toString(),
    createdAt: allocation.createdAt.toISOString(),
    invoice: {
      id: allocation.invoice.id,
      invoiceNumber: allocation.invoice.invoiceNumber,
      amount: allocation.invoice.amount.toString(),
      paymentStatus: allocation.invoice.paymentStatus,
      cashPaidOnInvoice: cashPaidOnInvoice.toString(),
      advanceAllocatedOnInvoice: advanceAllocatedOnInvoice.toString(),
      remaining: remaining.toString(),
    },
    advancePayment: {
      id: allocation.advancePayment.id,
      amount: allocation.advancePayment.amount.toString(),
      paidAt: allocation.advancePayment.paidAt.toISOString(),
      method: allocation.advancePayment.method,
      transactionRef: allocation.advancePayment.transactionRef,
      paidByName: allocation.advancePayment.paidBy.name,
      unallocatedOnPo: advanceUnallocated.toString(),
    },
    poId: allocation.invoice.poId,
    prId: allocation.invoice.purchaseOrder.prId,
    vendorName: allocation.invoice.purchaseOrder.vendor.businessName,
  };
}
