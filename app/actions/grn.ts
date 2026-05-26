"use server";

import type { GRNExceptionType } from "@prisma/client";
import { Role } from "@prisma/client";

import { applyPOClosureInTransaction, PO_CLOSURE_TX_OPTS } from "@/lib/poAutoClose";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { GRNLineInput } from "@/lib/purchase-lines";
import {
  getGRNById as getGRNByIdQuery,
  getGRNFilterOptions as getGRNFilterOptionsQuery,
  getGRNs as getGRNsQuery,
  getPOForGRNById as getPOForGRNByIdQuery,
  getPOsForGRN as getPOsForGRNQuery,
  searchPOsForGRN as searchPOsForGRNQuery,
} from "@/lib/queries/grn";
import type {
  GRNDetail,
  GRNFilters,
  GRNListRow,
  POForGRNOption,
} from "@/lib/queries/grn";
import { revalidateGRNMutation } from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";

// Re-export types from source — see note in app/actions/finder.ts.
export type {
  GRNDetail,
  GRNFilters,
  GRNListRow,
  POForGRNOption,
} from "@/lib/queries/grn";

export type CreateGRNInput = {
  poId: string;
  lineReceipts: GRNLineInput[];
  receivedAt: string;
  deliveryNoteRef?: string;
  exception?: {
    exceptionType: GRNExceptionType;
    exceptionQty: number;
    note: string;
  };
};

export async function getGRNs(filters: GRNFilters): Promise<Paginated<GRNListRow>> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getGRNsQuery(filters);
}

export async function getGRNById(id: string): Promise<GRNDetail | null> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getGRNByIdQuery(id);
}

export async function getPOsForGRN(): Promise<POForGRNOption[]> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getPOsForGRNQuery();
}

export async function searchPOsForGRN(q: string): Promise<POForGRNOption[]> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return searchPOsForGRNQuery(q);
}

export async function getPOForGRN(poId: string): Promise<POForGRNOption | null> {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getPOForGRNByIdQuery(poId);
}

export async function getGRNFilterOptions() {
  await requireRoles([Role.SM, Role.OPS_HEAD]);
  return getGRNFilterOptionsQuery();
}

export async function createGRN(
  data: CreateGRNInput,
): Promise<{ ok: boolean; grnId?: string; message?: string }> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD]);

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: data.poId },
    include: {
      lines: {
        include: {
          goodsReceiptLines: { select: { acceptedQty: true } },
        },
      },
    },
  });

  if (!po) {
    return { ok: false, message: "Purchase order not found." };
  }

  if (po.status !== "OPEN" && po.status !== "PARTIALLY_RECEIVED") {
    return { ok: false, message: "This PO is not open for goods receipt." };
  }

  if (data.lineReceipts.length === 0) {
    return { ok: false, message: "Enter received quantity for at least one line." };
  }

  const poLineIds = new Set(po.lines.map((l) => l.id));
  let receivedQty = 0;

  for (const receipt of data.lineReceipts) {
    if (!poLineIds.has(receipt.poLineId)) {
      return { ok: false, message: "Invalid PO line in receipt." };
    }
    if (receipt.receivedQty < 0) {
      return { ok: false, message: "Received quantity cannot be negative." };
    }
    const poLine = po.lines.find((l) => l.id === receipt.poLineId)!;
    const previouslyReceived = poLine.goodsReceiptLines.reduce(
      (s, grl) => s + grl.acceptedQty,
      0,
    );
    const pending = poLine.orderedQty - previouslyReceived;
    if (receipt.receivedQty > pending) {
      return {
        ok: false,
        message: `Received quantity exceeds pending qty for line ${poLine.id}.`,
      };
    }
    receivedQty += receipt.receivedQty;
  }

  if (receivedQty < 1) {
    return { ok: false, message: "Total received quantity must be at least 1." };
  }

  const exceptionQty = data.exception?.exceptionQty ?? 0;
  const acceptedQty = receivedQty - exceptionQty;
  const disputedQty = exceptionQty;

  if (acceptedQty < 0 || disputedQty < 0) {
    return { ok: false, message: "Invalid exception quantity." };
  }
  if (acceptedQty + disputedQty !== receivedQty) {
    return {
      ok: false,
      message: "Accepted and disputed quantities must sum to received quantity.",
    };
  }

  if (data.exception) {
    if (!data.exception.note.trim()) {
      return { ok: false, message: "Exception note is required." };
    }
    if (exceptionQty < 1) {
      return { ok: false, message: "Exception quantity must be at least 1." };
    }
    if (exceptionQty > receivedQty) {
      return { ok: false, message: "Exception quantity cannot exceed received quantity." };
    }
  }

  const receivedAt = new Date(data.receivedAt);
  if (Number.isNaN(receivedAt.getTime())) {
    return { ok: false, message: "Invalid receipt date." };
  }

  const grn = await prisma.$transaction(async (tx) => {
    const created = await tx.goodsReceipt.create({
      data: {
        poId: data.poId,
        receivedQty,
        acceptedQty,
        disputedQty,
        receivedById: user.id,
        receivedAt,
        deliveryNoteRef: data.deliveryNoteRef?.trim() || null,
      },
    });

    const positiveReceipts = data.lineReceipts.filter((r) => r.receivedQty > 0);
    let remainingException = exceptionQty;
    for (const receipt of positiveReceipts) {
      let lineAccepted = receipt.receivedQty;
      let lineDisputed = 0;
      if (remainingException > 0) {
        lineDisputed = Math.min(remainingException, receipt.receivedQty);
        lineAccepted = receipt.receivedQty - lineDisputed;
        remainingException -= lineDisputed;
      }
      await tx.goodsReceiptLine.create({
        data: {
          grnId: created.id,
          poLineId: receipt.poLineId,
          receivedQty: receipt.receivedQty,
          acceptedQty: lineAccepted,
          disputedQty: lineDisputed,
        },
      });
    }

    if (data.exception) {
      await tx.gRNException.create({
        data: {
          grnId: created.id,
          exceptionType: data.exception.exceptionType,
          exceptionQty: data.exception.exceptionQty,
          note: data.exception.note.trim(),
        },
      });
    }

    await applyPOClosureInTransaction(tx, data.poId);
    return created;
  }, PO_CLOSURE_TX_OPTS);

  revalidateGRNMutation(data.poId);

  return { ok: true, grnId: grn.id };
}
