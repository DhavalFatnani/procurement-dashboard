"use server";

import { revalidatePath } from "next/cache";
import { POStatus, Role, VendorStatus } from "@prisma/client";

import { dbSerial, paginatedQuery } from "@/lib/db-serial";
import { jaroWinklerDistance } from "@/lib/jaro-winkler-distance";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/server-action-guard";

const JW_THRESHOLD = 0.85;

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

export async function getVendors(
  filters: {
    search?: string;
    status?: VendorStatus | "ALL";
    page?: number;
    pageSize?: number;
  },
): Promise<Paginated<VendorListRow>> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);

  const status =
    filters.status && filters.status !== "ALL" ? filters.status : undefined;
  const q = filters.search?.trim();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

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

  const paginated = await paginatedQuery({
    page,
    pageSize,
    count: () => prisma.vendor.count({ where }),
    findMany: () =>
      prisma.vendor.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
        include: { createdBy: { select: { name: true } } },
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
  await requireRoles([Role.OPS_HEAD]);

  const rows = await prisma.vendorRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { requestedBy: { select: { name: true } } },
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

export type CreateVendorInput = {
  businessName: string;
  gst: string;
  address: string;
  pocName: string;
  phone: string;
  email: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  /** Required when fuzzy duplicate warning applies (Tier 2). */
  similarVendorAckReason?: string;
};

export type CreateVendorResult =
  | { ok: true; vendorId: string }
  | {
      ok: false;
      code: "DUPLICATE_FIELD";
      field: "phone" | "email" | "gst";
      existingVendorId: string;
      existingVendorName: string;
    }
  | {
      ok: false;
      code: "SIMILAR_VENDORS";
      matches: { id: string; businessName: string; pocName: string; phone: string }[];
    }
  | { ok: false; code: "VALIDATION"; message: string };

function normalizeGst(gst: string | undefined) {
  const t = gst?.trim();
  return t ? t.toUpperCase() : "";
}

export async function createVendor(input: CreateVendorInput): Promise<CreateVendorResult> {
  const user = await requireRoles([Role.OPS_HEAD]);

  const businessName = input.businessName.trim();
  const pocName = input.pocName.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const accountName = input.accountName.trim();
  const accountNumber = input.accountNumber.trim();
  const ifsc = input.ifsc.trim().toUpperCase();
  const bankName = input.bankName.trim();
  const gstNorm = normalizeGst(input.gst);
  const address = input.address.trim();

  if (!businessName || !pocName || !phone || !email) {
    return { ok: false, code: "VALIDATION", message: "Complete all required contact fields." };
  }
  if (!accountName || !accountNumber || !ifsc || !bankName) {
    return { ok: false, code: "VALIDATION", message: "Complete all bank details." };
  }

  const dupPhone = await prisma.vendor.findFirst({
    where: { phone },
    select: { id: true, businessName: true },
  });
  if (dupPhone) {
    return {
      ok: false,
      code: "DUPLICATE_FIELD",
      field: "phone",
      existingVendorId: dupPhone.id,
      existingVendorName: dupPhone.businessName,
    };
  }

  const dupEmail = await prisma.vendor.findFirst({
    where: { email },
    select: { id: true, businessName: true },
  });
  if (dupEmail) {
    return {
      ok: false,
      code: "DUPLICATE_FIELD",
      field: "email",
      existingVendorId: dupEmail.id,
      existingVendorName: dupEmail.businessName,
    };
  }

  if (gstNorm) {
    const dupGst = await prisma.vendor.findFirst({
      where: { gst: gstNorm },
      select: { id: true, businessName: true },
    });
    if (dupGst) {
      return {
        ok: false,
        code: "DUPLICATE_FIELD",
        field: "gst",
        existingVendorId: dupGst.id,
        existingVendorName: dupGst.businessName,
      };
    }
  }

  const allNames = await prisma.vendor.findMany({
    select: { id: true, businessName: true, pocName: true, phone: true },
  });

  const matches = allNames.filter((v) => {
    const score = jaroWinklerDistance(businessName, v.businessName);
    return score > JW_THRESHOLD;
  });

  const ack = input.similarVendorAckReason?.trim();
  if (matches.length > 0 && !ack) {
    return {
      ok: false,
      code: "SIMILAR_VENDORS",
      matches: matches.map((m) => ({
        id: m.id,
        businessName: m.businessName,
        pocName: m.pocName,
        phone: m.phone,
      })),
    };
  }

  const topMatch = matches[0];

  const vendor = await prisma.$transaction(async (tx) => {
    const v = await tx.vendor.create({
      data: {
        businessName,
        gst: gstNorm || null,
        address: address || null,
        pocName,
        phone,
        email,
        accountName,
        accountNumber,
        ifsc,
        bankName,
        status: VendorStatus.ACTIVE,
        hasSimilarVendorFlag: matches.length > 0,
        similarVendorId: topMatch?.id ?? null,
        createdById: user.id,
      },
    });

    if (matches.length > 0 && ack) {
      await tx.vendorChangeLog.create({
        data: {
          vendorId: v.id,
          fieldName: "DUPLICATE_WARNING_ACKNOWLEDGED",
          oldValue: matches.map((m) => m.businessName).join("; "),
          newValue: ack,
          changedById: user.id,
          reason: ack,
        },
      });
    }

    return v;
  });

  revalidatePath("/vendors");
  return { ok: true, vendorId: vendor.id };
}

function maskLogValue(fieldName: string, value: string | null | undefined): string | null {
  if (value == null || value === "") {
    return value ?? null;
  }
  if (fieldName === "accountNumber" || fieldName.toLowerCase().includes("account")) {
    const digits = value.replace(/\D/g, "");
    const last4 = digits.slice(-4) || value.slice(-4);
    return `••••${last4}`;
  }
  return value;
}

async function assertNoDuplicateFields(
  data: { phone: string; email: string; gst: string | null },
  excludeVendorId?: string,
): Promise<CreateVendorResult | null> {
  const notSelf = excludeVendorId ? { id: { not: excludeVendorId } } : {};

  const dupPhone = await prisma.vendor.findFirst({
    where: { phone: data.phone, ...notSelf },
    select: { id: true, businessName: true },
  });
  if (dupPhone) {
    return {
      ok: false,
      code: "DUPLICATE_FIELD",
      field: "phone",
      existingVendorId: dupPhone.id,
      existingVendorName: dupPhone.businessName,
    };
  }

  const dupEmail = await prisma.vendor.findFirst({
    where: { email: data.email, ...notSelf },
    select: { id: true, businessName: true },
  });
  if (dupEmail) {
    return {
      ok: false,
      code: "DUPLICATE_FIELD",
      field: "email",
      existingVendorId: dupEmail.id,
      existingVendorName: dupEmail.businessName,
    };
  }

  if (data.gst) {
    const dupGst = await prisma.vendor.findFirst({
      where: { gst: data.gst, ...notSelf },
      select: { id: true, businessName: true },
    });
    if (dupGst) {
      return {
        ok: false,
        code: "DUPLICATE_FIELD",
        field: "gst",
        existingVendorId: dupGst.id,
        existingVendorName: dupGst.businessName,
      };
    }
  }

  return null;
}

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

export async function getVendorById(
  id: string,
  options?: { poPage?: number; poPageSize?: number },
): Promise<VendorDetail | null> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);

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
          po.unitPrice != null ? `${Number(po.unitPrice) * po.orderedQty}` : null,
      })),
    },
  };
}

export type ActivateVendorFromRequestInput = {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  address?: string;
  gst?: string;
};

export type UpdateVendorInput = {
  pocName: string;
  phone: string;
  email: string;
  address: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  reason: string;
};

export type UpdateVendorResult =
  | { ok: true }
  | Exclude<CreateVendorResult, { ok: true; vendorId: string }>;

export async function updateVendor(
  id: string,
  input: UpdateVendorInput,
): Promise<UpdateVendorResult> {
  const user = await requireRoles([Role.OPS_HEAD]);

  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, code: "VALIDATION", message: "Reason for this edit is required." };
  }

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, code: "VALIDATION", message: "Vendor not found." };
  }

  const pocName = input.pocName.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const address = input.address.trim();
  const accountName = input.accountName.trim();
  const accountNumber = input.accountNumber.trim();
  const ifsc = input.ifsc.trim().toUpperCase();
  const bankName = input.bankName.trim();

  const dup = await assertNoDuplicateFields(
    { phone, email, gst: existing.gst },
    id,
  );
  if (dup) {
    return dup;
  }

  const updates: Partial<typeof existing> = {
    pocName,
    phone,
    email,
    address: address || null,
    accountName,
    accountNumber,
    ifsc,
    bankName,
  };

  const fields: (keyof typeof updates)[] = [
    "pocName",
    "phone",
    "email",
    "address",
    "accountName",
    "accountNumber",
    "ifsc",
    "bankName",
  ];

  await prisma.$transaction(async (tx) => {
    for (const field of fields) {
      const oldVal = existing[field];
      const newVal = updates[field];
      const oldStr = oldVal == null ? "" : String(oldVal);
      const newStr = newVal == null ? "" : String(newVal);
      if (oldStr !== newStr) {
        await tx.vendorChangeLog.create({
          data: {
            vendorId: id,
            fieldName: field,
            oldValue: maskLogValue(field, oldStr),
            newValue: maskLogValue(field, newStr),
            changedById: user.id,
            reason,
          },
        });
      }
    }
    await tx.vendor.update({ where: { id }, data: updates });
  });

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { ok: true };
}

export async function deactivateVendor(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireRoles([Role.OPS_HEAD]);
  await prisma.vendor.update({
    where: { id },
    data: { status: VendorStatus.INACTIVE },
  });
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { ok: true };
}

export async function reactivateVendor(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireRoles([Role.OPS_HEAD]);
  await prisma.vendor.update({
    where: { id },
    data: { status: VendorStatus.ACTIVE },
  });
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  return { ok: true };
}

export async function mergeVendors(
  primaryId: string,
  secondaryId: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRoles([Role.OPS_HEAD]);

  if (primaryId === secondaryId) {
    return { ok: false, message: "Cannot merge a vendor into itself." };
  }

  const [primary, secondary] = await dbSerial(
    () => prisma.vendor.findUnique({ where: { id: primaryId } }),
    () => prisma.vendor.findUnique({ where: { id: secondaryId } }),
  );

  if (!primary || !secondary) {
    return { ok: false, message: "One or both vendors were not found." };
  }

  await prisma.$transaction(async (tx) => {
    const moved = await tx.purchaseOrder.updateMany({
      where: { vendorId: secondaryId },
      data: { vendorId: primaryId },
    });

    await tx.vendor.update({
      where: { id: secondaryId },
      data: { status: VendorStatus.INACTIVE, similarVendorId: null },
    });

    await tx.vendor.update({
      where: { id: primaryId },
      data: { hasSimilarVendorFlag: false, similarVendorId: null },
    });

    await tx.vendorChangeLog.create({
      data: {
        vendorId: primaryId,
        fieldName: "MERGE",
        oldValue: secondary.businessName,
        newValue: `${moved.count} PO(s) re-linked`,
        changedById: user.id,
        reason: `Merged vendor ${secondary.businessName} (${secondaryId}) into ${primary.businessName}`,
      },
    });
  });

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${primaryId}`);
  revalidatePath(`/vendors/${secondaryId}`);
  return { ok: true };
}

export async function reviewVendorRequest(
  requestId: string,
  action: "ACTIVATED" | "REJECTED",
  reason?: string,
  bank?: ActivateVendorFromRequestInput,
): Promise<{ ok: boolean; message?: string; vendorId?: string }> {
  const user = await requireRoles([Role.OPS_HEAD]);

  const request = await prisma.vendorRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") {
    return { ok: false, message: "Request not found or already reviewed." };
  }

  if (action === "REJECTED") {
    if (!reason?.trim()) {
      return { ok: false, message: "A rejection reason is required." };
    }
    await prisma.vendorRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedById: user.id,
        reviewReason: reason.trim(),
      },
    });
    revalidatePath("/vendors");
    return { ok: true };
  }

  if (!bank?.accountName?.trim() || !bank.accountNumber?.trim() || !bank.ifsc?.trim() || !bank.bankName?.trim()) {
    return { ok: false, message: "Bank details are required to activate a vendor." };
  }

  const gstNorm = bank.gst?.trim() ? bank.gst.trim().toUpperCase() : null;

  const dup = await assertNoDuplicateFields({
    phone: request.phone,
    email: request.email,
    gst: gstNorm,
  });
  if (dup && !dup.ok) {
    const label =
      dup.code === "DUPLICATE_FIELD"
        ? `Duplicate ${dup.field}: ${dup.existingVendorName}`
        : "Duplicate vendor detected";
    return { ok: false, message: label };
  }

  const vendor = await prisma.$transaction(async (tx) => {
    const v = await tx.vendor.create({
      data: {
        businessName: request.businessName,
        pocName: request.pocName,
        phone: request.phone,
        email: request.email,
        gst: gstNorm,
        address: bank.address?.trim() || null,
        accountName: bank.accountName.trim(),
        accountNumber: bank.accountNumber.trim(),
        ifsc: bank.ifsc.trim().toUpperCase(),
        bankName: bank.bankName.trim(),
        status: VendorStatus.ACTIVE,
        createdById: user.id,
      },
    });
    await tx.vendorRequest.update({
      where: { id: requestId },
      data: {
        status: "ACTIVATED",
        reviewedById: user.id,
        activatedVendorId: v.id,
        reviewReason: reason?.trim() || null,
      },
    });
    return v;
  });

  revalidatePath("/vendors");
  return { ok: true, vendorId: vendor.id };
}

export async function getActiveVendors(): Promise<{ id: string; businessName: string }[]> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return prisma.vendor.findMany({
    where: { status: VendorStatus.ACTIVE },
    orderBy: { businessName: "asc" },
    select: { id: true, businessName: true },
  });
}
