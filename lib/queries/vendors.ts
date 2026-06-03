import { POStatus, VendorStatus } from "@/lib/prisma-enums";

import { paginatedQuery } from "@/lib/db-serial";
import { maskLogValue } from "@/lib/mask-log-value";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export type VendorListRow = {
  id: string;
  businessName: string;
  pocName: string;
  phone: string;
  email: string;
  accountLast4: string;
  status: VendorStatus;
  createdByName: string;
  updatedAt: string;
};

export type PendingVendorRequestRow = {
  id: string;
  businessName: string;
  pocName: string;
  phone: string;
  requestedByName: string;
  linkedPRId: string | null;
  createdAt: string;
};

export type VendorDetail = {
  id: string;
  businessName: string;
  gst: string | null;
  address: string | null;
  pocName: string;
  phone: string;
  email: string;
  accountName: string;
  accountLast4: string;
  ifsc: string;
  bankName: string;
  status: VendorStatus;
  hasSimilarVendorFlag: boolean;
  similarVendorId: string | null;
  similarVendorName: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  changeLogs: {
    id: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    changedByName: string;
    changedAt: string;
    reason: string | null;
  }[];
  purchaseOrders: Paginated<{
    id: string;
    status: POStatus;
    createdAt: string;
    totalValue: string | null;
  }>;
};

export async function getVendors(filters: {
  search?: string;
  status?: VendorStatus | "ALL";
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
}): Promise<Paginated<VendorListRow>> {
  const status =
    filters.status && filters.status !== "ALL" ? filters.status : undefined;
  const q = filters.search?.trim();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const clauses: object[] = [];
  if (status) {
    clauses.push({ status });
  }
  if (q) {
    clauses.push({
      OR: [
        { businessName: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }
  const where = clauses.length > 0 ? { AND: clauses } : {};

  const paginated = await paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount ?? false,
    count: () => prisma.vendor.count({ where }),
    findMany: ({ skip, take }) =>
      prisma.vendor.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          businessName: true,
          pocName: true,
          phone: true,
          email: true,
          accountNumber: true,
          status: true,
          updatedAt: true,
          createdBy: { select: { name: true } },
        },
      }),
  });

  return {
    ...paginated,
    items: paginated.items.map((v) => ({
      id: v.id,
      businessName: v.businessName,
      pocName: v.pocName,
      phone: v.phone,
      email: v.email,
      accountLast4: v.accountNumber.slice(-4),
      status: v.status,
      createdByName: v.createdBy.name,
      updatedAt: v.updatedAt.toISOString(),
    })),
  };
}

export async function getPendingVendorRequests(): Promise<PendingVendorRequestRow[]> {
  const rows = await prisma.vendorRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      businessName: true,
      pocName: true,
      phone: true,
      linkedPRId: true,
      createdAt: true,
      requestedBy: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    businessName: r.businessName,
    pocName: r.pocName,
    phone: r.phone,
    requestedByName: r.requestedBy.name,
    linkedPRId: r.linkedPRId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getVendorById(
  id: string,
  options?: { poPage?: number; poPageSize?: number },
): Promise<VendorDetail | null> {
  const poPage = Math.max(1, options?.poPage ?? 1);
  const poPageSize = Math.min(50, Math.max(5, options?.poPageSize ?? 10));
  const poSkip = (poPage - 1) * poPageSize;

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      similarTo: { select: { id: true, businessName: true } },
      vendorChangeLogs: {
        orderBy: { changedAt: "desc" },
        take: 100,
        include: { changedBy: { select: { name: true } } },
      },
    },
  });

  if (!vendor) {
    return null;
  }

  const poPaginated = await paginatedQuery({
    page: poPage,
    pageSize: poPageSize,
    count: () => prisma.purchaseOrder.count({ where: { vendorId: id } }),
    findMany: () =>
      prisma.purchaseOrder.findMany({
        where: { vendorId: id },
        orderBy: { createdAt: "desc" },
        skip: poSkip,
        take: poPageSize,
        select: {
          id: true,
          status: true,
          createdAt: true,
          unitPrice: true,
          orderedQty: true,
        },
      }),
  });

  return {
    id: vendor.id,
    businessName: vendor.businessName,
    gst: vendor.gst,
    address: vendor.address,
    pocName: vendor.pocName,
    phone: vendor.phone,
    email: vendor.email,
    accountName: vendor.accountName,
    accountLast4: vendor.accountNumber.slice(-4),
    ifsc: vendor.ifsc,
    bankName: vendor.bankName,
    status: vendor.status,
    hasSimilarVendorFlag: vendor.hasSimilarVendorFlag,
    similarVendorId: vendor.similarVendorId,
    similarVendorName: vendor.similarTo?.businessName ?? null,
    createdByName: vendor.createdBy.name,
    createdAt: vendor.createdAt.toISOString(),
    updatedAt: vendor.updatedAt.toISOString(),
    changeLogs: vendor.vendorChangeLogs.map((log) => ({
      id: log.id,
      fieldName: log.fieldName,
      oldValue: maskLogValue(log.fieldName, log.oldValue),
      newValue: maskLogValue(log.fieldName, log.newValue),
      changedByName: log.changedBy.name,
      changedAt: log.changedAt.toISOString(),
      reason: log.reason,
    })),
    purchaseOrders: {
      ...poPaginated,
      items: poPaginated.items.map((po) => ({
        id: po.id,
        status: po.status,
        createdAt: po.createdAt.toISOString(),
        totalValue:
          po.unitPrice != null && po.orderedQty != null
            ? `${Number(po.unitPrice) * po.orderedQty}`
            : null,
      })),
    },
  };
}

export async function getActiveVendors(): Promise<{ id: string; businessName: string }[]> {
  return prisma.vendor.findMany({
    where: { status: VendorStatus.ACTIVE },
    orderBy: { businessName: "asc" },
    select: { id: true, businessName: true },
  });
}
