"use server";

import { GRNExceptionResolution, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import { evaluatePOClosure } from "@/lib/poAutoClose";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  getApprovedPRsAwaitingPO as getApprovedPRsAwaitingPOQuery,
  getPOById as getPOByIdQuery,
  getPOFilterOptions as getPOFilterOptionsQuery,
  getPurchaseOrders as getPurchaseOrdersQuery,
} from "@/lib/queries/purchase-orders";
import type {
  ApprovedPRAwaitingPO,
  PODetail,
  PurchaseOrderFilters,
  PurchaseOrderListRow,
} from "@/lib/queries/purchase-orders";
import { revalidateProcurementLists } from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";

// Re-export types from source — see note in app/actions/finder.ts.
export type {
  ApprovedPRAwaitingPO,
  PODetail,
  PurchaseOrderFilters,
  PurchaseOrderListRow,
} from "@/lib/queries/purchase-orders";

export async function getApprovedPRsAwaitingPO(): Promise<ApprovedPRAwaitingPO[]> {
  await requireRoles([Role.OPS_HEAD]);
  return getApprovedPRsAwaitingPOQuery();
}

export async function getPurchaseOrders(
  filters: PurchaseOrderFilters,
): Promise<Paginated<PurchaseOrderListRow>> {
  await requireRoles([Role.SM, Role.OPS_HEAD, Role.FINANCE]);
  return getPurchaseOrdersQuery(filters);
}

export async function getPOById(id: string): Promise<PODetail | null> {
  await requireRoles([Role.SM, Role.OPS_HEAD, Role.FINANCE]);
  return getPOByIdQuery(id);
}

export async function getPOFilterOptions() {
  await requireRoles([Role.SM, Role.OPS_HEAD, Role.FINANCE]);
  return getPOFilterOptionsQuery();
}

export async function markDeliveryComplete(
  poId: string,
): Promise<MutationResult> {
  await requireRoles([Role.OPS_HEAD]);

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

export async function forceClosePO(
  poId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Reason is required." };
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
  if (!po) {
    return { ok: false, message: "Purchase order not found." };
  }

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "FORCE_CLOSED",
      forceClosedById: user.id,
      forceCloseReason: trimmed,
    },
  });

  revalidateProcurementLists(undefined, poId);
  return { ok: true };
}

export async function updatePOExpectedDelivery(
  poId: string,
  expectedDelivery: string,
): Promise<MutationResult> {
  await requireRoles([Role.OPS_HEAD]);

  const date = new Date(expectedDelivery);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: "Invalid date." };
  }

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { expectedDelivery: date },
  });

  revalidatePath(`/purchase-orders/${poId}`);
  return { ok: true };
}

export async function resolveGRNException(
  exceptionId: string,
  resolution: GRNExceptionResolution,
  note?: string,
): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);

  const exception = await prisma.gRNException.findUnique({
    where: { id: exceptionId },
    include: { grn: { select: { poId: true } } },
  });
  if (!exception) {
    return { ok: false, message: "Exception not found." };
  }

  if (resolution === "OVERRIDE_ACCEPTED" && !note?.trim()) {
    return { ok: false, message: "Override reason is required." };
  }

  await prisma.gRNException.update({
    where: { id: exceptionId },
    data: {
      resolutionStatus: resolution,
      resolvedById: user.id,
      resolvedAt: new Date(),
      resolutionNote: note?.trim() ?? null,
    },
  });

  await evaluatePOClosure(exception.grn.poId);
  revalidateProcurementLists(undefined, exception.grn.poId);
  revalidatePath("/goods-receipt");
  return { ok: true };
}

export async function runEvaluatePOClosure(
  poId: string,
): Promise<{ ok: boolean; status?: string; message?: string }> {
  await requireRoles([Role.OPS_HEAD]);
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
