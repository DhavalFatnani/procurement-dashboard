"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  ExecutionType,
  POAdvanceRequestStatus,
  POStatus,
  PRStatus,
  Prisma,
  Role,
  VendorItemPriceSource,
  VendorStatus,
} from "@/lib/prisma-client";

import type { MutationResult } from "@/lib/action-result";
import { newPurchaseOrderId, newPurchaseRequestId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { assertPRStatusTransition, evaluatePRStatus } from "@/lib/prStatus";
import { mapPrLinesFromDb, prLinesInclude } from "@/lib/map-pr-lines";
import {
  buildPORateCsv,
  parsePORateCsv,
  validatePORateCsvAgainstPR,
  type PORateCsvExportRow,
} from "@/lib/po-rate-csv";
import {
  resolveAdvanceRequestAmount,
  sumPendingAndFulfilledAdvanceRequests,
} from "@/lib/po-advance";
import { computePoOrderBilling, validatePoGstInput } from "@/lib/po-gst";
import {
  lockTagsQtyFromSelectedItems,
  sumItemQuantities,
} from "@/lib/purchase-lines";
import {
  approvePendingCatalogItems,
  headerFromFirstLine,
  lineTotalQuantity,
  PR_LINE_MUTATION_TX_OPTIONS,
  replacePRLines,
  validatePRLines,
} from "@/lib/pr-line-persistence";
import type {
  ApprovePRInput,
  CreatePOFromPRGroupInput,
  CreatePOFromPRInput,
  CreatePOItemPriceInput,
  PRFormData,
} from "@/lib/purchase-request-types";
import {
  listPendingCatalogItemsForPR,
} from "@/lib/pr-line-persistence";
import type { PendingCatalogItemRow } from "@/lib/queries/purchase-requests";
import {
  revalidateAdvanceRequestsCache,
  revalidateCreatePOFromPR,
  revalidatePRStatusChange,
  revalidatePurchaseRequestMutation,
  revalidateSerialGovernance,
} from "@/lib/revalidate-tags";
import { LIST_CACHE_TAGS } from "@/lib/list-cache";
import { timed } from "@/lib/server-timing";
import {
  SERIAL_RESERVE_TX_OPTS,
} from "@/lib/serialReservation";
import { releaseSerialReservationsForPR } from "@/lib/serial-admin";
import {
  commitVendorLockTagsHoldToPo,
  createVendorLockTagsApprovalHold,
  releaseVendorLockTagsApprovalHold,
} from "@/lib/vendor-lock-tags-serial";
import { requireRoles } from "@/lib/server-action-guard";
import { ALL_DASHBOARD_ROLES, FINANCE_OR_ADMIN_ROLES, OPS_FINANCE_OR_ADMIN_ROLES, OPS_OR_ADMIN_ROLES, PR_APPROVAL_ROLES, SM_OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";
import {
  assertSessionPurchaseRequestAccess,
  assertSessionWarehouseAccess,
} from "@/lib/warehouse-access";
import { assertSessionCanAccessWarehouse } from "@/lib/warehouse-scope";
import { canRevisePurchaseRequest, canUpdatePurchaseRequestLines } from "@/lib/pr-access";
import { getWarehousesAssignedToUser } from "@/lib/queries/warehouses";
import {
  recordVendorCatalogItemPrices,
  upsertCatalogItemVendorLinks,
} from "@/lib/vendor-item-links";

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

export async function createPR(data: PRFormData): Promise<{ ok: boolean; prId?: string; message?: string }> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const validated = await validatePRLines(data.lines);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const assigned = await getWarehousesAssignedToUser(user.id);
  const warehouseId =
    data.warehouseId ??
    (assigned.length === 1 ? assigned[0]!.id : null);
  if (!warehouseId) {
    return {
      ok: false,
      message:
        assigned.length === 0
          ? "Your profile has no warehouse assigned."
          : "Select a warehouse for this purchase request.",
    };
  }

  const access = await assertSessionWarehouseAccess(user, warehouseId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const header = headerFromFirstLine(data.lines, validated.subs);
  const prId = newPurchaseRequestId();
  const vendors = vendorFieldsForUser(user.role, data);

  await prisma.$transaction(
    async (tx) => {
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
      await replacePRLines(tx, prId, data.lines, user.id, header.executionType);
      if (vendors.vendorRequestId) {
        await tx.vendorRequest.update({
          where: { id: vendors.vendorRequestId },
          data: { linkedPRId: prId },
        });
      }
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

  revalidatePurchaseRequestMutation();
  return { ok: true, prId };
}

export async function updatePR(
  prId: string,
  data: PRFormData,
): Promise<MutationResult> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });
  if (!pr || (pr.status !== PRStatus.DRAFT && pr.status !== PRStatus.REVISION_REQUIRED)) {
    return { ok: false, message: "PR cannot be edited in its current status." };
  }
  if (
    !canUpdatePurchaseRequestLines(user, {
      status: pr.status,
      warehouseId: pr.warehouseId,
      createdById: pr.createdById,
    })
  ) {
    return { ok: false, message: "You cannot edit this purchase request." };
  }

  const warehouseAccess = await assertSessionPurchaseRequestAccess(user, prId);
  if (!warehouseAccess.ok) {
    return { ok: false, message: warehouseAccess.message };
  }

  const validated = await validatePRLines(data.lines);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const header = headerFromFirstLine(data.lines, validated.subs);
  const vendors = vendorFieldsForUser(user.role, data);

  await prisma.$transaction(
    async (tx) => {
      await tx.purchaseRequest.update({
        where: { id: prId },
        data: {
          ...header,
          vendorId: vendors.vendorId,
          vendorRequestId: vendors.vendorRequestId,
        },
      });
      await replacePRLines(tx, prId, data.lines, user.id, header.executionType);
      if (vendors.vendorRequestId) {
        await tx.vendorRequest.update({
          where: { id: vendors.vendorRequestId },
          data: { linkedPRId: prId },
        });
      }
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

  revalidatePurchaseRequestMutation(prId);
  return { ok: true };
}

export type SubmitPRForApprovalResult = {
  ok: boolean;
  prId?: string;
  message?: string;
};

/** Persist line items and move to PENDING_APPROVAL in one round trip. */
export async function submitPRForApproval(
  data: PRFormData,
  existingPrId?: string | null,
): Promise<SubmitPRForApprovalResult> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const validated = await validatePRLines(data.lines);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const header = headerFromFirstLine(data.lines, validated.subs);
  const vendors = vendorFieldsForUser(user.role, data);

  if (existingPrId) {
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: existingPrId },
      select: { status: true, warehouseId: true, createdById: true },
    });
    if (!pr || pr.status !== PRStatus.DRAFT) {
      return { ok: false, message: "PR cannot be submitted in its current status." };
    }
    if (user.role === Role.SM && pr.createdById !== user.id) {
      return { ok: false, message: "You can only submit your own purchase requests." };
    }
    const access = assertSessionCanAccessWarehouse(user, pr.warehouseId);
    if (!access.ok) {
      return { ok: false, message: access.message };
    }

    try {
      evaluatePRStatus(pr, PRStatus.PENDING_APPROVAL);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Cannot submit." };
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.purchaseRequest.update({
          where: { id: existingPrId },
          data: {
            ...header,
            vendorId: vendors.vendorId,
            vendorRequestId: vendors.vendorRequestId,
            status: PRStatus.PENDING_APPROVAL,
          },
        });
        await replacePRLines(tx, existingPrId, data.lines, user.id, header.executionType);
        if (vendors.vendorRequestId) {
          await tx.vendorRequest.update({
            where: { id: vendors.vendorRequestId },
            data: { linkedPRId: existingPrId },
          });
        }
        await tx.pRVersion.create({
          data: {
            prId: existingPrId,
            versionNumber: 1,
            changedById: user.id,
            revisionComment: "Submitted for approval",
            diffSnapshot: { action: "SUBMIT" },
          },
        });
      },
      PR_LINE_MUTATION_TX_OPTIONS,
    );

    revalidatePRStatusChange(existingPrId);
    return { ok: true, prId: existingPrId };
  }

  const assigned = await getWarehousesAssignedToUser(user.id);
  const warehouseId =
    data.warehouseId ?? (assigned.length === 1 ? assigned[0]!.id : null);
  if (!warehouseId) {
    return {
      ok: false,
      message:
        assigned.length === 0
          ? "Your profile has no warehouse assigned."
          : "Select a warehouse for this purchase request.",
    };
  }

  const warehouseAccess = await assertSessionWarehouseAccess(user, warehouseId);
  if (!warehouseAccess.ok) {
    return { ok: false, message: warehouseAccess.message };
  }

  const prId = newPurchaseRequestId();

  await prisma.$transaction(
    async (tx) => {
      await tx.purchaseRequest.create({
        data: {
          id: prId,
          ...header,
          warehouseId,
          vendorId: vendors.vendorId,
          vendorRequestId: vendors.vendorRequestId,
          status: PRStatus.PENDING_APPROVAL,
          createdById: user.id,
        },
      });
      await replacePRLines(tx, prId, data.lines, user.id, header.executionType);
      if (vendors.vendorRequestId) {
        await tx.vendorRequest.update({
          where: { id: vendors.vendorRequestId },
          data: { linkedPRId: prId },
        });
      }
      await tx.pRVersion.create({
        data: {
          prId,
          versionNumber: 1,
          changedById: user.id,
          revisionComment: "Submitted for approval",
          diffSnapshot: { action: "SUBMIT" },
        },
      });
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

  revalidatePRStatusChange(prId);
  return { ok: true, prId };
}

export async function submitPR(prId: string): Promise<MutationResult> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: { status: true, warehouseId: true, createdById: true },
  });
  if (!pr) {
    return { ok: false, message: "PR not found." };
  }
  if (user.role === Role.SM && pr.createdById !== user.id) {
    return { ok: false, message: "You can only submit your own purchase requests." };
  }

  const access = assertSessionCanAccessWarehouse(user, pr.warehouseId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  try {
    evaluatePRStatus(pr, PRStatus.PENDING_APPROVAL);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Cannot submit." };
  }

  await prisma.$transaction(
    async (tx) => {
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
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

  revalidatePRStatusChange(prId);
  return { ok: true };
}

export async function cancelPR(prId: string): Promise<MutationResult> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "PR not found." };
  }

  const warehouseAccess = await assertSessionPurchaseRequestAccess(user, prId);
  if (!warehouseAccess.ok) {
    return { ok: false, message: warehouseAccess.message };
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
    await releaseSerialReservationsForPR(tx, prId, user.id, "Purchase request cancelled");
  });

  revalidatePurchaseRequestMutation(prId);
  revalidateSerialGovernance();
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
  const user = await requireRoles([...PR_APPROVAL_ROLES]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Reason is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "PR not found." };
  }

  const warehouseAccess = await assertSessionPurchaseRequestAccess(user, prId);
  if (!warehouseAccess.ok) {
    return { ok: false, message: warehouseAccess.message };
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
    await releaseSerialReservationsForPR(tx, prId, user.id, trimmed);
  });

  revalidatePurchaseRequestMutation(prId);
  revalidateSerialGovernance();
  return { ok: true };
}

export async function resubmitPR(
  prId: string,
  data: PRFormData,
): Promise<MutationResult> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });
  if (!pr || pr.status !== PRStatus.REVISION_REQUIRED) {
    return { ok: false, message: "PR is not awaiting revision." };
  }
  if (
    !canRevisePurchaseRequest(user, {
      status: pr.status,
      warehouseId: pr.warehouseId,
      createdById: pr.createdById,
    })
  ) {
    return { ok: false, message: "You cannot resubmit this purchase request." };
  }

  const warehouseAccess = await assertSessionPurchaseRequestAccess(user, prId);
  if (!warehouseAccess.ok) {
    return { ok: false, message: warehouseAccess.message };
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

  await prisma.$transaction(
    async (tx) => {
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
      await replacePRLines(tx, prId, data.lines, user.id, header.executionType);
      await tx.pRVersion.create({
        data: {
          prId,
          versionNumber: pr.currentVersion + 1,
          changedById: user.id,
          revisionComment: "Resubmitted after revision",
          diffSnapshot: { ...diff, action: "RESUBMITTED" },
        },
      });
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

  revalidatePurchaseRequestMutation(prId);
  return { ok: true };
}

export async function createVendorRequest(
  data: { businessName: string; pocName: string; phone: string; email: string },
): Promise<{ ok: boolean; requestId?: string; message?: string }> {
  const user = await requireRoles([...SM_OPS_OR_ADMIN_ROLES]);

  const request = await prisma.vendorRequest.create({
    data: {
      businessName: data.businessName.trim(),
      pocName: data.pocName.trim(),
      phone: data.phone.trim(),
      email: data.email.trim().toLowerCase(),
      requestedById: user.id,
      status: "PENDING",
    },
  });

  revalidatePath("/vendors");
  return { ok: true, requestId: request.id };
}

export async function linkCatalogItemVendor(
  catalogItemId: string,
  vendorId: string,
): Promise<MutationResult> {
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, status: true },
  });
  if (!vendor || vendor.status !== VendorStatus.ACTIVE) {
    return { ok: false, message: "Select an active vendor." };
  }
  await prisma.catalogItemVendor.upsert({
    where: {
      catalogItemId_vendorId: { catalogItemId, vendorId },
    },
    create: { catalogItemId, vendorId, linkedById: user.id },
    update: { lastLinkedAt: new Date(), linkedById: user.id },
  });
  revalidateTag(LIST_CACHE_TAGS.vendorItems);
  revalidateTag(`${LIST_CACHE_TAGS.vendorItems}:${catalogItemId}`);
  return { ok: true };
}

export async function createPOFromPRGroup(
  prId: string,
  input: CreatePOFromPRGroupInput,
): Promise<{ ok: boolean; poId?: string; message?: string; fullyConverted?: boolean }> {
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: {
      purchaseOrders: { select: { id: true } },
      lines: {
        orderBy: { lineNumber: "asc" },
        include: {
          category: { select: { name: true } },
          subcategory: { select: { name: true } },
          items: {
            orderBy: { lineItemNumber: "asc" },
            include: {
              catalogItem: { select: { status: true } },
              poLineItem: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  const warehouseAccess = await assertSessionPurchaseRequestAccess(user, prId);
  if (!warehouseAccess.ok) {
    return { ok: false, message: warehouseAccess.message };
  }

  if (pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
    return { ok: false, message: "Purchase orders are only created for vendor purchase requests." };
  }
  if (pr.status !== PRStatus.APPROVED) {
    return { ok: false, message: "PR must be approved before creating a purchase order." };
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
    select: { id: true, status: true, gst: true },
  });
  if (!vendor || vendor.status !== VendorStatus.ACTIVE) {
    return { ok: false, message: "Select an active vendor." };
  }

  const allPrLineItems = pr.lines.flatMap((line) => line.items);
  const submittedIds = new Set((input.itemPrices ?? []).map((row) => row.prLineItemId));
  const selectedItems = allPrLineItems.filter((item) => submittedIds.has(item.id));

  if (selectedItems.length === 0) {
    return { ok: false, message: "Select at least one line item for this vendor group." };
  }
  if (selectedItems.length !== (input.itemPrices ?? []).length) {
    return { ok: false, message: "One or more line items do not belong to this PR." };
  }

  for (const item of selectedItems) {
    if (item.poLineItem) {
      return { ok: false, message: "One or more items already have a purchase order." };
    }
    if (item.catalogItem.status !== "ACTIVE") {
      return { ok: false, message: "All catalog items must be approved before creating a PO." };
    }
  }

  const priceByItemId = new Map<string, number>();
  for (const row of input.itemPrices ?? []) {
    if (!submittedIds.has(row.prLineItemId)) {
      continue;
    }
    const unitPrice = Number(row.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { ok: false, message: "Each unit price must be greater than zero." };
    }
    priceByItemId.set(row.prLineItemId, unitPrice);
  }

  for (const item of selectedItems) {
    if (!priceByItemId.has(item.id)) {
      return { ok: false, message: "Missing unit price for a catalog item." };
    }
  }

  const expectedDelivery = parseExpectedDeliveryDate(input.expectedDelivery);
  if (!expectedDelivery) {
    return { ok: false, message: "Expected delivery must be today or a future date." };
  }

  const gstApplicable = Boolean(input.gstApplicable);
  const gstValidated = validatePoGstInput(gstApplicable, input.gstRatePercent);
  if (!gstValidated.ok) {
    return { ok: false, message: gstValidated.message };
  }

  const billingLines = selectedItems.map((item) => ({
    orderedQty: item.quantity,
    unitPrice: priceByItemId.get(item.id)!,
  }));
  const committedTotal = computePoOrderBilling(
    billingLines,
    gstApplicable,
    gstValidated.rate != null ? String(gstValidated.rate) : null,
  ).total;

  let advanceToCreate: {
    amount: number;
    percent: number | null;
    reason: string;
  } | null = null;
  const advanceInput = input.advanceRequest;
  if (advanceInput?.reason?.trim()) {
    const resolved = resolveAdvanceRequestAmount(committedTotal, {
      amount: advanceInput.amount,
      percent: advanceInput.percent,
    });
    if (!resolved.ok) {
      return { ok: false, message: resolved.message };
    }
    advanceToCreate = {
      amount: resolved.amount,
      percent: resolved.percent,
      reason: advanceInput.reason.trim(),
    };
  }

  const totalOrderedQty = sumItemQuantities(selectedItems);
  const firstItemPrice = priceByItemId.get(selectedItems[0]!.id)!;
  const poId = newPurchaseOrderId();
  const selectedItemIds = new Set(selectedItems.map((item) => item.id));
  const lockTagsQty = lockTagsQtyFromSelectedItems(
    pr.lines.map((line) => ({
      categoryName: line.category.name,
      items: line.items.map((item) => ({ id: item.id, quantity: item.quantity })),
    })),
    selectedItemIds,
  );

  try {
    await prisma.$transaction(
      async (tx) => {
      await tx.purchaseOrder.create({
        data: {
          id: poId,
          prId: pr.id,
          vendorId,
          orderedQty: totalOrderedQty,
          unitPrice: new Prisma.Decimal(firstItemPrice),
          expectedDelivery,
          gstApplicable,
          gstRatePercent:
            gstValidated.rate != null ? new Prisma.Decimal(gstValidated.rate) : null,
          status: POStatus.OPEN,
          lineItems: {
            create: selectedItems.map((item) => {
              const parentLine = pr.lines.find((l) =>
                l.items.some((i) => i.id === item.id),
              )!;
              return {
                prLineItemId: item.id,
                catalogItemId: item.catalogItemId,
                categoryId: parentLine.categoryId,
                subcategoryId: parentLine.subcategoryId,
                orderedQty: item.quantity,
                unitPrice: new Prisma.Decimal(priceByItemId.get(item.id)!),
              };
            }),
          },
        },
      });

      await upsertCatalogItemVendorLinks(
        tx,
        selectedItems.map((item) => ({
          catalogItemId: item.catalogItemId,
          vendorId,
        })),
        user.id,
      );

      await recordVendorCatalogItemPrices(
        tx,
        selectedItems.map((item) => ({
          catalogItemId: item.catalogItemId,
          vendorId,
          unitPrice: priceByItemId.get(item.id)!,
          source: VendorItemPriceSource.PO,
          poId,
          prId: pr.id,
          recordedById: user.id,
        })),
      );

      if (lockTagsQty > 0) {
        await commitVendorLockTagsHoldToPo(tx, {
          prId: pr.id,
          poId,
          quantity: lockTagsQty,
          warehouseId: pr.warehouseId,
          createdById: user.id,
        });
      }

      if (advanceToCreate) {
        const existingRequests = await tx.pOAdvanceRequest.findMany({
          where: {
            poId,
            status: {
              in: [POAdvanceRequestStatus.PENDING, POAdvanceRequestStatus.FULFILLED],
            },
          },
          select: { status: true, requestedAmount: true },
        });
        const reserved = sumPendingAndFulfilledAdvanceRequests(existingRequests);
        if (reserved + advanceToCreate.amount > committedTotal + 0.001) {
          throw new Error(
            `Total advance requests would exceed PO committed value (${committedTotal.toFixed(2)}).`,
          );
        }
        await tx.pOAdvanceRequest.create({
          data: {
            poId,
            requestedAmount: new Prisma.Decimal(advanceToCreate.amount),
            requestedPercent:
              advanceToCreate.percent != null
                ? new Prisma.Decimal(advanceToCreate.percent)
                : null,
            reason: advanceToCreate.reason,
            status: POAdvanceRequestStatus.PENDING,
            requestedById: user.id,
          },
        });
      }

      const remainingUnassigned = await tx.purchaseRequestLineItem.count({
        where: {
          prLine: { prId },
          poLineItem: null,
        },
      });

      const fullyConverted = remainingUnassigned === 0;

      if (fullyConverted) {
        try {
          assertPRStatusTransition(pr.status, PRStatus.CONVERTED_TO_PO);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : "Invalid status.");
        }
        await tx.purchaseRequest.update({
          where: { id: prId },
          data: { status: PRStatus.CONVERTED_TO_PO },
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
              itemPrices: input.itemPrices,
              expectedDelivery: expectedDelivery.toISOString(),
              gstApplicable,
              gstRatePercent: gstValidated.rate,
            },
          },
        });
      } else {
        await tx.pRVersion.create({
          data: {
            prId,
            versionNumber: pr.currentVersion,
            changedById: user.id,
            revisionComment: `Partial PO created (${selectedItems.length} item(s))`,
            diffSnapshot: {
              action: "PARTIAL_PO_CREATED",
              poId,
              vendorId,
              itemPrices: input.itemPrices,
              expectedDelivery: expectedDelivery.toISOString(),
              gstApplicable,
              gstRatePercent: gstValidated.rate,
            },
          },
        });
      }
    },
    lockTagsQty > 0
      ? {
          ...PR_LINE_MUTATION_TX_OPTIONS,
          isolationLevel: SERIAL_RESERVE_TX_OPTS.isolationLevel,
        }
      : PR_LINE_MUTATION_TX_OPTIONS,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create purchase order.";
    if (message.includes("ceiling")) {
      return {
        ok: false,
        message:
          "Serial range ceiling reached for lock tags. Contact Ops Head to update the ceiling.",
      };
    }
    return { ok: false, message };
  }

  const remainingAfter = await prisma.purchaseRequestLineItem.count({
    where: { prLine: { prId }, poLineItem: null },
  });
  const fullyConverted = remainingAfter === 0;

  revalidateCreatePOFromPR(prId, poId);
  if (lockTagsQty > 0) {
    revalidateSerialGovernance();
  }
  if (advanceToCreate) {
    revalidateAdvanceRequestsCache();
  }
  revalidateTag(LIST_CACHE_TAGS.vendorItems);
  for (const item of selectedItems) {
    revalidateTag(`${LIST_CACHE_TAGS.vendorItems}:${item.catalogItemId}`);
  }
  return { ok: true, poId, fullyConverted };
}

export async function createPOFromPR(
  prId: string,
  input: CreatePOFromPRInput,
): Promise<{ ok: boolean; poId?: string; message?: string }> {
  const result = await createPOFromPRGroup(prId, input);
  return result;
}

export async function fetchPendingCatalogItemsForPR(
  prId: string,
): Promise<
  | { ok: true; items: PendingCatalogItemRow[] }
  | { ok: false; message: string }
> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  const items = await listPendingCatalogItemsForPR(prId);
  return {
    ok: true,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      subcategoryName: item.subcategory.name,
      categoryName: item.subcategory.category.name,
    })),
  };
}

export async function exportPORateCsvForPR(
  prId: string,
  prLineItemIds?: string[],
): Promise<
  | { ok: true; csv: string; filename: string }
  | { ok: false; message: string }
> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: {
      id: true,
      status: true,
      executionType: true,
      lines: prLinesInclude,
    },
  });

  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }
  if (pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
    return { ok: false, message: "Rate CSV is only for vendor purchase requests." };
  }
  if (pr.status !== PRStatus.APPROVED) {
    return { ok: false, message: "PR must be approved before exporting rates." };
  }

  const lines = mapPrLinesFromDb(pr.lines);
  const allowedIds = prLineItemIds?.length ? new Set(prLineItemIds) : null;
  const rows: PORateCsvExportRow[] = lines.flatMap((line) =>
    line.items
      .filter((item) => !allowedIds || allowedIds.has(item.id))
      .map((item) => ({
      prLineItemId: item.id,
      prId: pr.id,
      lineNumber: line.lineNumber,
      lineItemNumber: item.lineItemNumber,
      category: line.categoryName,
      subcategory: line.subcategoryName,
      itemName: item.itemName,
      sku: item.sku ?? "",
      unit: item.unit,
      quantity: item.quantity,
      unitPriceInr: "",
    })),
  );

  if (rows.length === 0) {
    return { ok: false, message: "No catalog items on this PR." };
  }

  return {
    ok: true,
    csv: buildPORateCsv(rows),
    filename: `${pr.id}-po-rates.csv`,
  };
}

export async function validatePORateCsvForPR(
  prId: string,
  csvText: string,
  prLineItemIds?: string[],
): Promise<
  | { ok: true; itemPrices: CreatePOItemPriceInput[] }
  | { ok: false; message: string }
> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: {
      id: true,
      status: true,
      executionType: true,
      lines: prLinesInclude,
    },
  });

  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }
  if (pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
    return { ok: false, message: "Rate CSV is only for vendor purchase requests." };
  }
  if (pr.status !== PRStatus.APPROVED) {
    return { ok: false, message: "PR must be approved before importing rates." };
  }

  const parsed = parsePORateCsv(csvText.trim());
  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }

  const lines = mapPrLinesFromDb(pr.lines);
  const allowedIds = prLineItemIds?.length ? new Set(prLineItemIds) : null;
  const expectedItems = lines.flatMap((line) =>
    line.items
      .filter((item) => !allowedIds || allowedIds.has(item.id))
      .map((item) => ({ id: item.id, quantity: item.quantity })),
  );

  const validated = validatePORateCsvAgainstPR(parsed.rows, {
    prId: pr.id,
    items: expectedItems,
  });
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  return {
    ok: true,
    itemPrices: validated.itemPrices.map((row) => ({
      prLineItemId: row.prLineItemId,
      unitPrice: row.unitPrice,
    })),
  };
}

export async function approvePR(
  prId: string,
  catalogReview: ApprovePRInput,
): Promise<MutationResult> {
  return timed("action.approvePR", async () => {
    const user = await requireRoles([...PR_APPROVAL_ROLES]);

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
          include: {
            category: { select: { name: true } },
            items: { select: { id: true, quantity: true } },
          },
        },
      },
    });
    if (!pr) {
      return { ok: false, message: "Purchase request not found." };
    }

    const warehouseAccess = await assertSessionPurchaseRequestAccess(user, prId);
    if (!warehouseAccess.ok) {
      return { ok: false, message: warehouseAccess.message };
    }

    if (pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
      return { ok: false, message: "Use standard approval for non-vendor requests." };
    }

    try {
      assertPRStatusTransition(pr.status, PRStatus.APPROVED);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
    }

    const allItemIds = new Set(
      pr.lines.flatMap((line) => line.items.map((item) => item.id)),
    );
    const lockTagsQty = lockTagsQtyFromSelectedItems(
      pr.lines.map((line) => ({
        categoryName: line.category.name,
        items: line.items,
      })),
      allItemIds,
    );

    const catalogResult = await prisma.$transaction(
      async (tx) => {
        const catalogOk = await approvePendingCatalogItems(
          tx,
          prId,
          catalogReview,
          user.id,
        );
        if (!catalogOk.ok) {
          return catalogOk;
        }

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
            diffSnapshot: {
              action: "APPROVED",
              catalogReview,
            },
          },
        });

        if (lockTagsQty > 0) {
          await createVendorLockTagsApprovalHold(tx, {
            prId,
            quantity: lockTagsQty,
            warehouseId: pr.warehouseId,
            createdById: user.id,
          });
        }

        return { ok: true as const };
      },
      lockTagsQty > 0
        ? {
            ...PR_LINE_MUTATION_TX_OPTIONS,
            isolationLevel: SERIAL_RESERVE_TX_OPTS.isolationLevel,
          }
        : PR_LINE_MUTATION_TX_OPTIONS,
    );

    if (!catalogResult.ok) {
      return { ok: false, message: catalogResult.message };
    }

    const hasCatalogDecisions =
      catalogReview.approvedCatalogItemIds.length > 0 ||
      catalogReview.rejected.length > 0;
    revalidatePRStatusChange(prId, {
      affectsAwaitingPo: true,
      affectsCatalog: hasCatalogDecisions,
    });
    if (lockTagsQty > 0) {
      revalidateSerialGovernance();
    }
    return { ok: true };
  });
}

export async function rejectPR(
  prId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await requireRoles([...PR_APPROVAL_ROLES]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Rejection reason is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  const warehouseAccess = await assertSessionPurchaseRequestAccess(user, prId);
  if (!warehouseAccess.ok) {
    return { ok: false, message: warehouseAccess.message };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.REJECTED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  await prisma.$transaction(
    async (tx) => {
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
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

  revalidatePRStatusChange(prId);
  return { ok: true };
}

export async function sendForRevision(
  prId: string,
  revisionComment: string,
): Promise<MutationResult> {
  const user = await requireRoles([...PR_APPROVAL_ROLES]);
  const comment = revisionComment.trim();
  if (!comment) {
    return { ok: false, message: "Revision comment is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  const warehouseAccess = await assertSessionPurchaseRequestAccess(user, prId);
  if (!warehouseAccess.ok) {
    return { ok: false, message: warehouseAccess.message };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.REVISION_REQUIRED);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  await prisma.$transaction(
    async (tx) => {
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
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

  revalidatePRStatusChange(prId);
  return { ok: true };
}

export async function revertPRApproval(
  prId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await requireRoles([...PR_APPROVAL_ROLES]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Reason is required." };
  }

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: {
      lines: { include: { items: { include: { poLineItem: { select: { id: true } } } } } },
      purchaseOrders: { select: { id: true } },
    },
  });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }

  const warehouseAccess = await assertSessionPurchaseRequestAccess(user, prId);
  if (!warehouseAccess.ok) {
    return { ok: false, message: warehouseAccess.message };
  }

  if (pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
    return { ok: false, message: "Only vendor purchase requests can be reverted." };
  }

  try {
    assertPRStatusTransition(pr.status, PRStatus.PENDING_APPROVAL);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
  }

  if (pr.purchaseOrders.length > 0) {
    return {
      ok: false,
      message: "Cannot revert approval after a purchase order has been created.",
    };
  }

  const assignedLineItems = pr.lines
    .flatMap((line) => line.items)
    .filter((item) => item.poLineItem != null).length;
  if (assignedLineItems > 0) {
    return {
      ok: false,
      message: "Cannot revert approval while line items are assigned to a purchase order.",
    };
  }

  await prisma.$transaction(
    async (tx) => {
      await releaseVendorLockTagsApprovalHold(tx, prId);
      await tx.purchaseRequest.update({
        where: { id: prId },
        data: { status: PRStatus.PENDING_APPROVAL },
      });
      await tx.pRVersion.create({
        data: {
          prId,
          versionNumber: pr.currentVersion,
          changedById: user.id,
          revisionComment: trimmed,
          diffSnapshot: { action: "REVERT_APPROVAL", reason: trimmed },
        },
      });
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

  revalidatePRStatusChange(prId, { affectsAwaitingPo: true });
  revalidateSerialGovernance();
  return { ok: true };
}
