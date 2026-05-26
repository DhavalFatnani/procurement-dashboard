"use server";

import { revalidatePath } from "next/cache";
import {
  ExecutionType,
  POStatus,
  PRStatus,
  Prisma,
  Role,
  VendorStatus,
} from "@prisma/client";

import type { MutationResult } from "@/lib/action-result";
import { newPurchaseOrderId, newPurchaseRequestId } from "@/lib/ids";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  getFilterOptions as getFilterOptionsQuery,
  getPRById as getPRByIdQuery,
  getPurchaseRequests as getPurchaseRequestsQuery,
} from "@/lib/queries/purchase-requests";
import type {
  CategoryOption,
  PRDetail,
  PRLineRow,
  PurchaseRequestFilters,
  PurchaseRequestListRow,
  SubcategoryOption,
  UserOption,
  WarehouseOption,
} from "@/lib/queries/purchase-requests";
import { assertPRStatusTransition, evaluatePRStatus } from "@/lib/prStatus";
import { hasLockTagsLines, LOCK_TAGS_SERIES, MAX_PR_LINES } from "@/lib/purchase-lines";
import { revalidatePurchaseRequestMutation } from "@/lib/revalidate-tags";
import { atomicReserveSerialRange } from "@/lib/serialReservation";
import { requireRoles } from "@/lib/server-action-guard";

// Re-export types from source — see note in app/actions/finder.ts.
export type {
  CategoryOption,
  PRDetail,
  PRLineRow,
  PurchaseRequestFilters,
  PurchaseRequestListRow,
  SubcategoryOption,
  UserOption,
  WarehouseOption,
} from "@/lib/queries/purchase-requests";

export async function getFilterOptions() {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getFilterOptionsQuery();
}

export async function getPurchaseRequests(
  filters: PurchaseRequestFilters & { page?: number; pageSize?: number },
): Promise<Paginated<PurchaseRequestListRow>> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getPurchaseRequestsQuery(user, filters);
}

export async function getPRById(id: string): Promise<PRDetail | null> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getPRByIdQuery(user, id);
}

export type PRLineInput = {
  categoryId: string;
  subcategoryId: string;
  quantity: number;
  notes?: string;
};

export type PRFormData = {
  lines: PRLineInput[];
  vendorId?: string | null;
  vendorRequestId?: string | null;
};

export type CreatePOLinePriceInput = {
  prLineId: string;
  unitPrice: number;
};

export type CreatePOFromPRInput = {
  vendorId: string;
  linePrices: CreatePOLinePriceInput[];
  expectedDelivery: string;
};

function vendorFieldsForUser(
  role: Role,
  data: Pick<PRFormData, "vendorId" | "vendorRequestId">,
): { vendorId: string | null; vendorRequestId: string | null } {
  if (role === Role.SM) {
    return {
      vendorId: null,
      vendorRequestId: data.vendorRequestId || null,
    };
  }
  return {
    vendorId: data.vendorId || null,
    vendorRequestId: data.vendorRequestId || null,
  };
}

function parseExpectedDeliveryDate(isoDate: string): Date | null {
  const trimmed = isoDate.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date < today) {
    return null;
  }
  return date;
}

async function validatePRLines(
  lines: PRLineInput[],
): Promise<
  | { ok: true; subs: { id: string; executionType: ExecutionType; categoryId: string }[] }
  | { ok: false; message: string }
> {
  if (lines.length < 1) {
    return { ok: false, message: "Add at least one line item." };
  }
  if (lines.length > MAX_PR_LINES) {
    return { ok: false, message: `Maximum ${MAX_PR_LINES} line items allowed.` };
  }

  const subs = [];
  for (const line of lines) {
    if (line.quantity < 1) {
      return { ok: false, message: "Each line quantity must be at least 1." };
    }
    const sub = await prisma.subcategory.findUnique({ where: { id: line.subcategoryId } });
    if (!sub || sub.categoryId !== line.categoryId) {
      return { ok: false, message: "Invalid category or subcategory on a line." };
    }
    subs.push(sub);
  }

  const executionTypes = new Set(subs.map((s) => s.executionType));
  if (executionTypes.size > 1) {
    return { ok: false, message: "All lines must share the same execution type." };
  }
  if (subs[0]!.executionType === ExecutionType.INTERNAL_PRINT && lines.length > 1) {
    return { ok: false, message: "Internal print requests support a single line only." };
  }
  if (subs[0]!.executionType === ExecutionType.VENDOR_PURCHASE) {
    for (const sub of subs) {
      if (sub.executionType !== ExecutionType.VENDOR_PURCHASE) {
        return { ok: false, message: "Multi-line requests must use vendor-purchase subcategories." };
      }
    }
  }

  return { ok: true, subs };
}

function headerFromFirstLine(
  lines: PRLineInput[],
  subs: { executionType: ExecutionType }[],
) {
  const first = lines[0]!;
  return {
    categoryId: first.categoryId,
    subcategoryId: first.subcategoryId,
    quantity: first.quantity,
    executionType: subs[0]!.executionType,
  };
}

async function replacePRLines(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  prId: string,
  lines: PRLineInput[],
) {
  await tx.purchaseRequestLine.deleteMany({ where: { prId } });
  await tx.purchaseRequestLine.createMany({
    data: lines.map((line, index) => ({
      prId,
      lineNumber: index + 1,
      categoryId: line.categoryId,
      subcategoryId: line.subcategoryId,
      quantity: line.quantity,
      notes: line.notes?.trim() || null,
    })),
  });
}

export async function createPR(data: PRFormData): Promise<{ ok: boolean; prId?: string; message?: string }> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const validated = await validatePRLines(data.lines);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const warehouseId = user.warehouseId;
  if (!warehouseId) {
    return { ok: false, message: "Your profile has no warehouse assigned." };
  }

  const header = headerFromFirstLine(data.lines, validated.subs);
  const prId = newPurchaseRequestId();
  const vendors = vendorFieldsForUser(user.role, data);

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.create({
      data: {
        id: prId,
        ...header,
        warehouseId,
        vendorId: vendors.vendorId,
        vendorRequestId: vendors.vendorRequestId,
        status: PRStatus.DRAFT,
        createdById: user.id,
      },
    });
    await replacePRLines(tx, prId, data.lines);
    if (data.vendorRequestId) {
      await tx.vendorRequest.update({
        where: { id: data.vendorRequestId },
        data: { linkedPRId: prId },
      });
    }
  });

  revalidatePurchaseRequestMutation();
  return { ok: true, prId };
}

export async function updatePR(
  prId: string,
  data: PRFormData,
): Promise<MutationResult> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });
  if (!pr || (pr.status !== PRStatus.DRAFT && pr.status !== PRStatus.REVISION_REQUIRED)) {
    return { ok: false, message: "PR cannot be edited in its current status." };
  }
  if (user.role === Role.SM && pr.createdById !== user.id) {
    return { ok: false, message: "You can only edit your own purchase requests." };
  }

  const validated = await validatePRLines(data.lines);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const header = headerFromFirstLine(data.lines, validated.subs);
  const vendors = vendorFieldsForUser(user.role, data);

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: {
        ...header,
        vendorId: vendors.vendorId,
        vendorRequestId: vendors.vendorRequestId,
      },
    });
    await replacePRLines(tx, prId, data.lines);
  });

  revalidatePurchaseRequestMutation(prId);
  return { ok: true };
}

export async function submitPR(prId: string): Promise<MutationResult> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "PR not found." };
  }

  try {
    evaluatePRStatus(pr, PRStatus.PENDING_APPROVAL);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Cannot submit." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.PENDING_APPROVAL },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: 1,
        changedById: user.id,
        revisionComment: "Submitted for approval",
        diffSnapshot: { action: "SUBMIT" },
      },
    });
  });

  revalidatePurchaseRequestMutation(prId);
  return { ok: true };
}

export async function cancelPR(prId: string): Promise<MutationResult> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "PR not found." };
  }

  try {
    evaluatePRStatus(pr, PRStatus.CANCELLED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Cannot cancel." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.CANCELLED },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: "Cancelled",
        diffSnapshot: { action: "CANCELLED" },
      },
    });
  });

  revalidatePurchaseRequestMutation(prId);
  return { ok: true };
}

const FORCE_CLOSE_ALLOWED: PRStatus[] = [
  PRStatus.DRAFT,
  PRStatus.PENDING_APPROVAL,
  PRStatus.REVISION_REQUIRED,
  PRStatus.APPROVED,
  PRStatus.REJECTED,
];

export async function forceClosePR(
  prId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Reason is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "PR not found." };
  }

  if (!FORCE_CLOSE_ALLOWED.includes(pr.status)) {
    return { ok: false, message: `Cannot force close a PR in ${pr.status} status.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.FORCE_CANCELLED },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: trimmed,
        diffSnapshot: { action: "FORCE_CLOSE", reason: trimmed },
      },
    });
  });

  revalidatePurchaseRequestMutation(prId);
  return { ok: true };
}

export async function resubmitPR(
  prId: string,
  data: PRFormData,
): Promise<MutationResult> {
  const user = await requireRoles([Role.SM]);
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });
  if (!pr || pr.status !== PRStatus.REVISION_REQUIRED) {
    return { ok: false, message: "PR is not awaiting revision." };
  }
  if (pr.createdById !== user.id) {
    return { ok: false, message: "You can only resubmit your own purchase requests." };
  }

  if (pr.revisionCount >= 3) {
    await prisma.$transaction(async (tx) => {
      await tx.purchaseRequest.update({
        where: { id: prId },
        data: { status: PRStatus.FORCE_CANCELLED },
      });
      await tx.pRVersion.create({
        data: {
          prId,
          versionNumber: pr.currentVersion,
          changedById: user.id,
          revisionComment: "Force cancelled after 3 revision cycles",
          diffSnapshot: { action: "FORCE_CANCELLED_REVISION_CAP" },
        },
      });
    });
    revalidatePurchaseRequestMutation(prId);
    return { ok: false, message: "Maximum revision cycles reached. PR was force cancelled." };
  }

  const validated = await validatePRLines(data.lines);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const header = headerFromFirstLine(data.lines, validated.subs);
  const vendors = vendorFieldsForUser(user.role, {
    vendorId: data.vendorId,
    vendorRequestId: data.vendorRequestId ?? pr.vendorRequestId,
  });

  const diff = {
    lines: {
      from: pr.lines.map((l) => ({
        lineNumber: l.lineNumber,
        categoryId: l.categoryId,
        subcategoryId: l.subcategoryId,
        quantity: l.quantity,
      })),
      to: data.lines,
    },
  };

  try {
    evaluatePRStatus(pr, PRStatus.PENDING_APPROVAL);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Cannot resubmit." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: {
        ...header,
        vendorId: vendors.vendorId,
        vendorRequestId: vendors.vendorRequestId,
        status: PRStatus.PENDING_APPROVAL,
        currentVersion: { increment: 1 },
        revisionCount: { increment: 1 },
      },
    });
    await replacePRLines(tx, prId, data.lines);
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion + 1,
        changedById: user.id,
        revisionComment: "Resubmitted after revision",
        diffSnapshot: { ...diff, action: "RESUBMITTED" },
      },
    });
  });

  revalidatePurchaseRequestMutation(prId);
  return { ok: true };
}

export async function createVendorRequest(
  data: { businessName: string; pocName: string; phone: string; email: string },
  prId?: string,
): Promise<{ ok: boolean; requestId?: string; message?: string }> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);

  const request = await prisma.vendorRequest.create({
    data: {
      businessName: data.businessName.trim(),
      pocName: data.pocName.trim(),
      phone: data.phone.trim(),
      email: data.email.trim().toLowerCase(),
      requestedById: user.id,
      linkedPRId: prId ?? null,
      status: "PENDING",
    },
  });

  if (prId) {
    await prisma.purchaseRequest.update({
      where: { id: prId },
      data: { vendorRequestId: request.id, vendorId: null },
    });
  }

  revalidatePath("/vendors");
  revalidatePurchaseRequestMutation(prId);
  return { ok: true, requestId: request.id };
}

export async function createPOFromPR(
  prId: string,
  input: CreatePOFromPRInput,
): Promise<{ ok: boolean; poId?: string; message?: string }> {
  const user = await requireRoles([Role.OPS_HEAD]);

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: {
      purchaseOrder: true,
      lines: {
        orderBy: { lineNumber: "asc" },
        include: {
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
        },
      },
    },
  });

  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }
  if (pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
    return { ok: false, message: "Purchase orders are only created for vendor purchase requests." };
  }
  if (pr.status !== PRStatus.APPROVED) {
    return { ok: false, message: "PR must be approved before creating a purchase order." };
  }
  if (pr.purchaseOrder) {
    return { ok: false, message: "A purchase order already exists for this PR." };
  }
  if (pr.lines.length === 0) {
    return { ok: false, message: "Purchase request has no line items." };
  }

  const vendorId = input.vendorId?.trim();
  if (!vendorId) {
    return { ok: false, message: "Select a vendor." };
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, status: true },
  });
  if (!vendor || vendor.status !== VendorStatus.ACTIVE) {
    return { ok: false, message: "Select an active vendor." };
  }

  if (input.linePrices.length !== pr.lines.length) {
    return { ok: false, message: "Enter a unit price for each line item." };
  }

  const priceByLineId = new Map<string, number>();
  for (const row of input.linePrices) {
    const unitPrice = Number(row.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { ok: false, message: "Each unit price must be greater than zero." };
    }
    priceByLineId.set(row.prLineId, unitPrice);
  }

  for (const line of pr.lines) {
    if (!priceByLineId.has(line.id)) {
      return { ok: false, message: "Missing unit price for a line item." };
    }
  }

  const expectedDelivery = parseExpectedDeliveryDate(input.expectedDelivery);
  if (!expectedDelivery) {
    return { ok: false, message: "Expected delivery must be today or a future date." };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.CONVERTED_TO_PO);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  const totalOrderedQty = pr.lines.reduce((s, l) => s + l.quantity, 0);
  const firstLinePrice = priceByLineId.get(pr.lines[0]!.id)!;
  const poId = newPurchaseOrderId();
  const lockTagsQty = pr.lines
    .filter((l) => l.category.name === "Lock Tags")
    .reduce((s, l) => s + l.quantity, 0);

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.create({
      data: {
        id: poId,
        prId: pr.id,
        vendorId,
        orderedQty: totalOrderedQty,
        unitPrice: new Prisma.Decimal(firstLinePrice),
        expectedDelivery,
        status: POStatus.OPEN,
        lines: {
          create: pr.lines.map((line) => ({
            prLineId: line.id,
            categoryId: line.categoryId,
            subcategoryId: line.subcategoryId,
            orderedQty: line.quantity,
            unitPrice: new Prisma.Decimal(priceByLineId.get(line.id)!),
          })),
        },
      },
    });
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.CONVERTED_TO_PO, vendorId },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: "Converted to purchase order",
        diffSnapshot: {
          action: "CONVERTED_TO_PO",
          poId,
          vendorId,
          linePrices: input.linePrices,
          expectedDelivery: expectedDelivery.toISOString(),
        },
      },
    });
  });

  if (lockTagsQty > 0 && hasLockTagsLines(pr.lines.map((l) => ({ categoryName: l.category.name })))) {
    const reservation = await atomicReserveSerialRange({
      series: LOCK_TAGS_SERIES,
      quantity: lockTagsQty,
      warehouseId: pr.warehouseId,
      createdById: user.id,
      prId: pr.id,
      idempotencyKey: `po-${poId}-lock-tags`,
    });
    if (reservation.success) {
      await prisma.serialReservation.update({
        where: { id: reservation.reservation.id },
        data: { poId },
      });
    }
  }

  revalidatePurchaseRequestMutation(prId, { purchaseOrders: true });
  return { ok: true, poId };
}

export async function approvePR(prId: string): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.APPROVED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.APPROVED },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: "Approved",
        diffSnapshot: { action: "APPROVED" },
      },
    });
  });

  revalidatePurchaseRequestMutation(prId, { purchaseOrders: true });
  return { ok: true };
}

export async function rejectPR(
  prId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Rejection reason is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.REJECTED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: { status: PRStatus.REJECTED },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: trimmed,
        diffSnapshot: { action: "REJECTED", reason: trimmed },
      },
    });
  });

  revalidatePurchaseRequestMutation(prId, { purchaseOrders: true });
  return { ok: true };
}

export async function sendForRevision(
  prId: string,
  revisionComment: string,
): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);
  const comment = revisionComment.trim();
  if (!comment) {
    return { ok: false, message: "Revision comment is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.REVISION_REQUIRED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseRequest.update({
      where: { id: prId },
      data: {
        status: PRStatus.REVISION_REQUIRED,
        revisionCount: { increment: 1 },
      },
    });
    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: pr.currentVersion,
        changedById: user.id,
        revisionComment: comment,
        diffSnapshot: { action: "REVISION_REQUIRED", revisionComment: comment },
      },
    });
  });

  revalidatePurchaseRequestMutation(prId);
  return { ok: true };
}
