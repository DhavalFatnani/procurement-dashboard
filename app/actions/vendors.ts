"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma, Role, VendorStatus } from "@/lib/prisma-client";

import type { MutationResult } from "@/lib/action-result";
import { dbParallel } from "@/lib/db-parallel";
import { jaroWinklerDistance } from "@/lib/jaro-winkler-distance";
import { logger } from "@/lib/logger";
import { maskLogValue } from "@/lib/mask-log-value";
import { vendorCreateSchema, vendorUpdateSchema } from "@/lib/validation/vendor";
import {
  getActiveVendors as getActiveVendorsQuery,
  getPendingVendorRequests as getPendingVendorRequestsQuery,
  getVendorById as getVendorByIdQuery,
  getVendors as getVendorsQuery,
} from "@/lib/queries/vendors";
import type {
  PendingVendorRequestRow,
  VendorDetail,
  VendorListRow,
} from "@/lib/queries/vendors";
import { revalidateDashboardMetrics } from "@/lib/revalidate-tags";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/server-action-guard";

const JW_THRESHOLD = 0.85;

export async function getVendors(
  filters: {
    search?: string;
    status?: VendorStatus | "ALL";
    page?: number;
    pageSize?: number;
  },
): Promise<Paginated<VendorListRow>> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getVendorsQuery(filters);
}

export async function getPendingVendorRequests(): Promise<PendingVendorRequestRow[]> {
  await requireRoles([Role.OPS_HEAD]);
  return getPendingVendorRequestsQuery();
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

export async function createVendor(input: CreateVendorInput): Promise<CreateVendorResult> {
  const user = await requireRoles([Role.OPS_HEAD]);

  const {
    businessName,
    pocName,
    phone,
    email,
    accountName,
    accountNumber,
    ifsc,
    bankName,
    gst: gstNorm,
    address,
  } = vendorCreateSchema.parse(input);

  if (!businessName || !pocName || !phone || !email) {
    return { ok: false, code: "VALIDATION", message: "Complete all required contact fields." };
  }
  if (!accountName || !accountNumber || !ifsc || !bankName) {
    return { ok: false, code: "VALIDATION", message: "Complete all bank details." };
  }

  const dup = await assertNoDuplicateFields({ phone, email, gst: gstNorm || null });
  if (dup) {
    return dup;
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
  revalidateTag("vendor-options");
  return { ok: true, vendorId: vendor.id };
}

type DuplicateFieldResult = Extract<CreateVendorResult, { code: "DUPLICATE_FIELD" }>;

/**
 * Detects a vendor that collides on phone, email, or GST in a single query,
 * then reports the first conflict in priority order (phone → email → gst) to
 * match the field-level messaging the UI expects.
 */
async function assertNoDuplicateFields(
  data: { phone: string; email: string; gst: string | null },
  excludeVendorId?: string,
): Promise<DuplicateFieldResult | null> {
  const notSelf = excludeVendorId ? { id: { not: excludeVendorId } } : {};

  const or: Prisma.VendorWhereInput[] = [{ phone: data.phone }, { email: data.email }];
  if (data.gst) {
    or.push({ gst: data.gst });
  }

  const candidates = await prisma.vendor.findMany({
    where: { OR: or, ...notSelf },
    select: { id: true, businessName: true, phone: true, email: true, gst: true },
  });

  const dupOn = (
    match: { id: string; businessName: string } | undefined,
    field: DuplicateFieldResult["field"],
  ): DuplicateFieldResult | null =>
    match
      ? {
          ok: false,
          code: "DUPLICATE_FIELD",
          field,
          existingVendorId: match.id,
          existingVendorName: match.businessName,
        }
      : null;

  const phoneDup = dupOn(candidates.find((c) => c.phone === data.phone), "phone");
  if (phoneDup) return phoneDup;

  const emailDup = dupOn(candidates.find((c) => c.email === data.email), "email");
  if (emailDup) return emailDup;

  if (data.gst) {
    const gst = data.gst;
    const gstDup = dupOn(candidates.find((c) => c.gst === gst), "gst");
    if (gstDup) return gstDup;
  }

  return null;
}

export async function getVendorById(
  id: string,
  options?: { poPage?: number; poPageSize?: number },
): Promise<VendorDetail | null> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getVendorByIdQuery(id, options);
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

  const {
    pocName,
    phone,
    email,
    address,
    accountName,
    accountNumber,
    ifsc,
    bankName,
    reason,
  } = vendorUpdateSchema.parse(input);

  if (!reason) {
    return { ok: false, code: "VALIDATION", message: "Reason for this edit is required." };
  }

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, code: "VALIDATION", message: "Vendor not found." };
  }

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
  revalidateTag("vendor-options");
  return { ok: true };
}

export async function deactivateVendor(id: string): Promise<MutationResult> {
  await requireRoles([Role.OPS_HEAD]);
  try {
    await prisma.vendor.update({
      where: { id },
      data: { status: VendorStatus.INACTIVE },
    });
  } catch (err) {
    logger.error({ err, vendorId: id }, "deactivateVendor failed");
    return { ok: false, message: "Failed to deactivate vendor." };
  }
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  revalidateTag("vendor-options");
  return { ok: true };
}

export async function reactivateVendor(id: string): Promise<MutationResult> {
  await requireRoles([Role.OPS_HEAD]);
  try {
    await prisma.vendor.update({
      where: { id },
      data: { status: VendorStatus.ACTIVE },
    });
  } catch (err) {
    logger.error({ err, vendorId: id }, "reactivateVendor failed");
    return { ok: false, message: "Failed to reactivate vendor." };
  }
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  revalidateTag("vendor-options");
  return { ok: true };
}

export async function mergeVendors(
  primaryId: string,
  secondaryId: string,
): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);

  if (primaryId === secondaryId) {
    return { ok: false, message: "Cannot merge a vendor into itself." };
  }

  const [primary, secondary] = await dbParallel(
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
  revalidateTag("vendor-options");
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
  revalidatePath("/purchase-requests");
  revalidateTag("vendor-options");
  revalidateDashboardMetrics();
  return { ok: true, vendorId: vendor.id };
}

export async function getActiveVendors(): Promise<{ id: string; businessName: string }[]> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getActiveVendorsQuery();
}
