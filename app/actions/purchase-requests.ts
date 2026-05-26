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
import { prisma } from "@/lib/prisma";
import { assertPRStatusTransition, evaluatePRStatus } from "@/lib/prStatus";
import { mapPrLinesFromDb, prLinesInclude } from "@/lib/map-pr-lines";
import {
  buildPORateCsv,
  parsePORateCsv,
  validatePORateCsvAgainstPR,
  type PORateCsvExportRow,
} from "@/lib/po-rate-csv";
import { hasLockTagsLines, LOCK_TAGS_SERIES, sumItemQuantities } from "@/lib/purchase-lines";
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
  CreatePOFromPRInput,
  CreatePOItemPriceInput,
  PRFormData,
} from "@/lib/purchase-request-types";
import {
  listPendingCatalogItemsForPR,
} from "@/lib/pr-line-persistence";
import type { PendingCatalogItemRow } from "@/lib/queries/purchase-requests";
import {
  revalidateCreatePOFromPR,
  revalidatePRStatusChange,
  revalidatePurchaseRequestMutation,
} from "@/lib/revalidate-tags";
import { timed } from "@/lib/server-timing";
import { atomicReserveSerialRange } from "@/lib/serialReservation";
import { requireRoles } from "@/lib/server-action-guard";
import { assertUserWarehouseAccess } from "@/lib/warehouse-access";
import { getWarehousesAssignedToUser } from "@/lib/queries/warehouses";

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
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);
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

  const access = await assertUserWarehouseAccess(user.id, warehouseId);
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
      if (data.vendorRequestId) {
        await tx.vendorRequest.update({
          where: { id: data.vendorRequestId },
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
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

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
          items: {
            orderBy: { lineItemNumber: "asc" },
            include: {
              catalogItem: { select: { status: true } },
            },
          },
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

  const prLineItems = pr.lines.flatMap((line) => line.items);
  if (prLineItems.length === 0) {
    return { ok: false, message: "Purchase request has no catalog items." };
  }
  for (const item of prLineItems) {
    if (item.catalogItem.status !== "ACTIVE") {
      return { ok: false, message: "All catalog items must be approved before creating a PO." };
    }
  }

  const itemPrices = input.itemPrices ?? [];
  if (itemPrices.length !== prLineItems.length) {
    return { ok: false, message: "Enter a unit price for each catalog item." };
  }

  const priceByItemId = new Map<string, number>();
  for (const row of itemPrices) {
    const unitPrice = Number(row.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { ok: false, message: "Each unit price must be greater than zero." };
    }
    priceByItemId.set(row.prLineItemId, unitPrice);
  }

  for (const item of prLineItems) {
    if (!priceByItemId.has(item.id)) {
      return { ok: false, message: "Missing unit price for a catalog item." };
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

  const totalOrderedQty = sumItemQuantities(prLineItems);
  const firstItemPrice = priceByItemId.get(prLineItems[0]!.id)!;
  const poId = newPurchaseOrderId();
  const lockTagsQty = pr.lines
    .filter((l) => l.category.name === "Lock Tags")
    .reduce((s, l) => s + sumItemQuantities(l.items), 0);

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
          status: POStatus.OPEN,
          lineItems: {
            create: prLineItems.map((item) => {
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
            itemPrices: input.itemPrices,
            expectedDelivery: expectedDelivery.toISOString(),
          },
        },
      });
    },
    PR_LINE_MUTATION_TX_OPTIONS,
  );

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

  revalidateCreatePOFromPR(prId, poId);
  return { ok: true, poId };
}

export async function fetchPendingCatalogItemsForPR(
  prId: string,
): Promise<
  | { ok: true; items: PendingCatalogItemRow[] }
  | { ok: false; message: string }
> {
  await requireRoles([Role.OPS_HEAD]);
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
): Promise<
  | { ok: true; csv: string; filename: string }
  | { ok: false; message: string }
> {
  await requireRoles([Role.OPS_HEAD]);

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
  const rows: PORateCsvExportRow[] = lines.flatMap((line) =>
    line.items.map((item) => ({
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
): Promise<
  | { ok: true; itemPrices: CreatePOItemPriceInput[] }
  | { ok: false; message: string }
> {
  await requireRoles([Role.OPS_HEAD]);

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
  const expectedItems = lines.flatMap((line) =>
    line.items.map((item) => ({ id: item.id, quantity: item.quantity })),
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
    const user = await requireRoles([Role.OPS_HEAD]);

    const pr = await prisma.purchaseRequest.findUnique({ where: { id: prId } });
    if (!pr) {
      return { ok: false, message: "Purchase request not found." };
    }
    if (pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
      return { ok: false, message: "Use standard approval for non-vendor requests." };
    }

    try {
      assertPRStatusTransition(pr.status, PRStatus.APPROVED);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Invalid status." };
    }

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
        return { ok: true as const };
      },
      PR_LINE_MUTATION_TX_OPTIONS,
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
    return { ok: true };
  });
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
