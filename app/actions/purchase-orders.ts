"use server";

import { POStatus, Role } from "@/lib/prisma-enums";
import { revalidatePath } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import type { ResolveGrnExceptionInput } from "@/lib/grn-resolution-types";
import {
  applyGrnExceptionResolutionInTransaction,
  GRN_EXCEPTION_RESOLVE_INCLUDE,
  validateResolveGrnExceptionInput,
} from "@/lib/grn-resolution";
import {
  applyPOClosureInTransaction,
  evaluatePOClosure,
  PO_CLOSURE_TX_OPTS,
} from "@/lib/poAutoClose";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  getApprovedPRsAwaitingPO as getApprovedPRsAwaitingPOQuery,
  getPOByIdForPage as getPOByIdForPageQuery,
  getPOFilterOptions as getPOFilterOptionsQuery,
  getPurchaseOrders as getPurchaseOrdersQuery,
} from "@/lib/queries/purchase-orders";
import type {
  ApprovedPRAwaitingPO,
  PODetail,
  PurchaseOrderFilters,
  PurchaseOrderListRow,
} from "@/lib/queries/purchase-orders";
import {
  revalidateProcurementLists,
  revalidatePurchaseOrdersCache,
  revalidateSerialGovernance,
} from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";
import { ALL_DASHBOARD_ROLES, FINANCE_OR_ADMIN_ROLES, OPS_FINANCE_OR_ADMIN_ROLES, OPS_OR_ADMIN_ROLES, PR_APPROVAL_ROLES, SM_OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";
import {
  createVendorLockTagsApprovalHold,
  releaseVendorLockTagsApprovalHold,
  releaseVendorLockTagsPoReservation,
} from "@/lib/vendor-lock-tags-serial";
import { releaseSerialReservationsForPO } from "@/lib/serial-admin";
import { lockTagsQtyFromSelectedItems } from "@/lib/purchase-lines";
import { assertSessionPurchaseOrderAccess } from "@/lib/warehouse-access";
import { scopeWarehouseIdsForUser } from "@/lib/warehouse-scope";

export async function getApprovedPRsAwaitingPO(): Promise<ApprovedPRAwaitingPO[]> {
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);
  return getApprovedPRsAwaitingPOQuery({
    scopeWarehouseIds: scopeWarehouseIdsForUser(user),
  });
}

export async function getPurchaseOrders(
  filters: PurchaseOrderFilters,
): Promise<Paginated<PurchaseOrderListRow>> {
  const user = await requireRoles([...ALL_DASHBOARD_ROLES]);
  return getPurchaseOrdersQuery({
    ...filters,
    scopeWarehouseIds: filters.scopeWarehouseIds ?? scopeWarehouseIdsForUser(user),
  });
}

export async function getPOById(id: string): Promise<PODetail | null> {
  const user = await requireRoles([...ALL_DASHBOARD_ROLES]);
  return getPOByIdForPageQuery(user, id);
}

export async function getPOFilterOptions() {
  await requireRoles([...ALL_DASHBOARD_ROLES]);
  return getPOFilterOptionsQuery();
}

export async function markDeliveryComplete(
  poId: string,
): Promise<MutationResult> {
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) {
    return { ok: false, message: "Purchase order not found." };
  }

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { deliveryComplete: true },
  });

  await evaluatePOClosure(poId);
  revalidateProcurementLists(undefined, poId);
  return { ok: true };
}

/** Cancel an OPEN PO before any GRN — releases lock-tag serial reservation and unassigns line items. */
export async function cancelPO(
  poId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Reason is required." };
  }

  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      grns: { select: { id: true }, take: 1 },
      invoices: { select: { id: true }, take: 1 },
      advancePayments: { select: { id: true }, take: 1 },
      purchaseRequest: {
        select: {
          id: true,
          status: true,
          currentVersion: true,
          warehouseId: true,
        },
      },
    },
  });
  if (!po) {
    return { ok: false, message: "Purchase order not found." };
  }

  if (po.status !== POStatus.OPEN) {
    return {
      ok: false,
      message: "Only open purchase orders with no receipts can be cancelled.",
    };
  }
  if (po.grns.length > 0) {
    return {
      ok: false,
      message: "Cannot cancel a purchase order after goods have been received.",
    };
  }
  if (po.invoices.length > 0) {
    return {
      ok: false,
      message: "Cannot cancel a purchase order that has invoices.",
    };
  }
  if (po.advancePayments.length > 0) {
    return {
      ok: false,
      message: "Cannot cancel a purchase order with advance payments recorded.",
    };
  }

  const prId = po.purchaseRequest.id;

  await prisma.$transaction(async (tx) => {
    await releaseVendorLockTagsPoReservation(tx, poId);
    await tx.purchaseOrder.delete({ where: { id: poId } });

    const remainingPos = await tx.purchaseOrder.count({ where: { prId } });
    const nextPrStatus =
      remainingPos === 0 && po.purchaseRequest.status === "CONVERTED_TO_PO"
        ? "APPROVED"
        : po.purchaseRequest.status;

    if (nextPrStatus !== po.purchaseRequest.status) {
      await tx.purchaseRequest.update({
        where: { id: prId },
        data: { status: nextPrStatus },
      });
    }

    if (nextPrStatus === "APPROVED") {
      const prLines = await tx.purchaseRequest.findUnique({
        where: { id: prId },
        select: {
          warehouseId: true,
          lines: {
            select: {
              category: { select: { name: true } },
              items: {
                select: {
                  id: true,
                  quantity: true,
                  poLineItem: { select: { id: true } },
                },
              },
            },
          },
        },
      });
      const unassignedIds = new Set(
        (prLines?.lines ?? [])
          .flatMap((line) => line.items)
          .filter((item) => item.poLineItem == null)
          .map((item) => item.id),
      );
      const unassignedLockTagsQty = lockTagsQtyFromSelectedItems(
        (prLines?.lines ?? []).map((line) => ({
          categoryName: line.category.name,
          items: line.items.filter((item) => unassignedIds.has(item.id)),
        })),
        unassignedIds,
      );
      await releaseVendorLockTagsApprovalHold(tx, prId);
      if (unassignedLockTagsQty > 0 && prLines) {
        await createVendorLockTagsApprovalHold(tx, {
          prId,
          quantity: unassignedLockTagsQty,
          warehouseId: prLines.warehouseId,
          createdById: user.id,
        });
      }
    }

    await tx.pRVersion.create({
      data: {
        prId,
        versionNumber: po.purchaseRequest.currentVersion,
        changedById: user.id,
        revisionComment: trimmed,
        diffSnapshot: { action: "PO_CANCELLED", poId, reason: trimmed },
      },
    });
  });

  revalidateProcurementLists(prId, poId);
  revalidateSerialGovernance();
  return { ok: true };
}

export async function forceClosePO(
  poId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await requireRoles([...PR_APPROVAL_ROLES]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Reason is required." };
  }

  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) {
    return { ok: false, message: "Purchase order not found." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: "FORCE_CLOSED",
        forceClosedById: user.id,
        forceCloseReason: trimmed,
      },
    });
    await releaseSerialReservationsForPO(tx, poId, user.id, trimmed);
  });

  revalidateProcurementLists(undefined, poId);
  revalidateSerialGovernance();
  return { ok: true };
}

export async function updatePOExpectedDelivery(
  poId: string,
  expectedDelivery: string,
): Promise<MutationResult> {
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const date = new Date(expectedDelivery);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: "Invalid date." };
  }

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { expectedDelivery: date },
  });

  revalidatePurchaseOrdersCache(poId);
  revalidatePath(`/purchase-orders/${poId}`);
  return { ok: true };
}

export async function resolveGRNException(
  exceptionId: string,
  input: ResolveGrnExceptionInput,
): Promise<MutationResult> {
  const user = await requireRoles([...PR_APPROVAL_ROLES]);

  const exception = await prisma.gRNException.findUnique({
    where: { id: exceptionId },
    include: GRN_EXCEPTION_RESOLVE_INCLUDE,
  });
  if (!exception) {
    return { ok: false, message: "Exception not found." };
  }

  const validated = validateResolveGrnExceptionInput(exception.exceptionType, input);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const access = await assertSessionPurchaseOrderAccess(user, exception.grn.poId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  let poId: string;
  try {
    await prisma.$transaction(async (tx) => {
      await applyGrnExceptionResolutionInTransaction(tx, exception, input, user.id);
      await applyPOClosureInTransaction(tx, exception.grn.poId);
    }, PO_CLOSURE_TX_OPTS);
    poId = exception.grn.poId;
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to resolve exception.",
    };
  }

  revalidateProcurementLists(undefined, poId);
  revalidatePath("/goods-receipt");
  revalidatePath(`/purchase-orders/${poId}`);
  return { ok: true };
}

export async function runEvaluatePOClosure(
  poId: string,
): Promise<{ ok: boolean; status?: string; message?: string }> {
  const user = await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const access = await assertSessionPurchaseOrderAccess(user, poId);
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  try {
    const snapshot = await evaluatePOClosure(poId);
    revalidateProcurementLists(undefined, poId);
    return { ok: true, status: snapshot.status };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Evaluation failed.",
    };
  }
}
