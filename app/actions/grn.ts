"use server";

import type { GRNExceptionType } from "@prisma/client";
import { Role } from "@prisma/client";

import { applyPOClosureInTransaction, PO_CLOSURE_TX_OPTS } from "@/lib/poAutoClose";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { GRNLineInput, GRNLineItemInput } from "@/lib/purchase-lines";
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

export type CreateGRNInput = {
  poId: string;
  lineItemReceipts: GRNLineItemInput[];
  /** @deprecated Use lineItemReceipts */
  lineReceipts?: GRNLineInput[];
  receivedAt: string;
  deliveryNoteRef?: string;
  /** @deprecated Flag exceptions on each lineItemReceipts[].exception instead */
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
      lineItems: {
        include: {
          goodsReceiptLineItems: { select: { acceptedQty: true } },
        },
      },
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

  const useLineItems = po.lineItems.length > 0;
  const receipts: GRNLineItemInput[] = useLineItems
    ? data.lineItemReceipts
    : (data.lineReceipts ?? []).map((r) => ({
        poLineItemId: r.poLineId,
        receivedQty: r.receivedQty,
      }));

  if (receipts.length === 0) {
    return { ok: false, message: "Enter received quantity for at least one line." };
  }

  let receivedQty = 0;

  if (useLineItems) {
    const poLineItemIds = new Set(po.lineItems.map((l) => l.id));
    for (const receipt of receipts) {
      if (!poLineItemIds.has(receipt.poLineItemId)) {
        return { ok: false, message: "Invalid PO catalog item in receipt." };
      }
      if (receipt.receivedQty < 0) {
        return { ok: false, message: "Received quantity cannot be negative." };
      }
      const poLine = po.lineItems.find((l) => l.id === receipt.poLineItemId)!;
      const previouslyReceived = poLine.goodsReceiptLineItems.reduce(
        (s, grl) => s + grl.acceptedQty,
        0,
      );
      const pending = poLine.orderedQty - previouslyReceived;
      if (receipt.receivedQty > pending) {
        return {
          ok: false,
          message: `Received quantity exceeds pending qty for ${receipt.poLineItemId}.`,
        };
      }
      receivedQty += receipt.receivedQty;
    }
  } else {
    const poLineIds = new Set(po.lines.map((l) => l.id));
    for (const receipt of data.lineReceipts ?? []) {
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
  }

  if (receivedQty < 1) {
    return { ok: false, message: "Total received quantity must be at least 1." };
  }

  let disputedQty = 0;
  const lineExceptions: {
    poLineItemId: string;
    exception: NonNullable<GRNLineItemInput["exception"]>;
  }[] = [];

  for (const receipt of receipts) {
    if (!receipt.exception) {
      continue;
    }
    if (receipt.receivedQty < 1) {
      return {
        ok: false,
        message: "Cannot flag an exception on a line with zero received quantity.",
      };
    }
    if (!receipt.exception.note.trim()) {
      return { ok: false, message: "Exception note is required for each flagged line." };
    }
    if (receipt.exception.exceptionQty < 1) {
      return { ok: false, message: "Exception quantity must be at least 1 per flagged line." };
    }
    if (receipt.exception.exceptionQty > receipt.receivedQty) {
      return {
        ok: false,
        message: "Exception quantity cannot exceed received quantity on that line.",
      };
    }
    disputedQty += receipt.exception.exceptionQty;
    lineExceptions.push({
      poLineItemId: receipt.poLineItemId,
      exception: receipt.exception,
    });
  }

  if (data.exception) {
    if (!data.exception.note.trim()) {
      return { ok: false, message: "Exception note is required." };
    }
    if (data.exception.exceptionQty < 1) {
      return { ok: false, message: "Exception quantity must be at least 1." };
    }
    if (data.exception.exceptionQty > receivedQty) {
      return { ok: false, message: "Exception quantity cannot exceed received quantity." };
    }
    if (lineExceptions.length > 0) {
      return {
        ok: false,
        message: "Use per-line exceptions instead of a receipt-level exception.",
      };
    }
    disputedQty = data.exception.exceptionQty;
  }

  const acceptedQty = receivedQty - disputedQty;

  if (acceptedQty < 0 || disputedQty < 0) {
    return { ok: false, message: "Invalid exception quantity." };
  }
  if (acceptedQty + disputedQty !== receivedQty) {
    return {
      ok: false,
      message: "Accepted and disputed quantities must sum to received quantity.",
    };
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

    const positiveReceipts = receipts.filter((r) => r.receivedQty > 0);
    let remainingLegacyException = data.exception?.exceptionQty ?? 0;
    for (const receipt of positiveReceipts) {
      const lineExceptionQty = receipt.exception?.exceptionQty ?? 0;
      let lineDisputed = lineExceptionQty;
      if (lineDisputed === 0 && remainingLegacyException > 0) {
        lineDisputed = Math.min(remainingLegacyException, receipt.receivedQty);
        remainingLegacyException -= lineDisputed;
      }
      const lineAccepted = receipt.receivedQty - lineDisputed;
      if (useLineItems) {
        await tx.goodsReceiptLineItem.create({
          data: {
            grnId: created.id,
            poLineItemId: receipt.poLineItemId,
            receivedQty: receipt.receivedQty,
            acceptedQty: lineAccepted,
            disputedQty: lineDisputed,
          },
        });
      } else {
        await tx.goodsReceiptLine.create({
          data: {
            grnId: created.id,
            poLineId: receipt.poLineItemId,
            receivedQty: receipt.receivedQty,
            acceptedQty: lineAccepted,
            disputedQty: lineDisputed,
          },
        });
      }
    }

    for (const row of lineExceptions) {
      await tx.gRNException.create({
        data: {
          grnId: created.id,
          poLineItemId: useLineItems ? row.poLineItemId : null,
          poLineId: useLineItems ? null : row.poLineItemId,
          exceptionType: row.exception.exceptionType,
          exceptionQty: row.exception.exceptionQty,
          note: row.exception.note.trim(),
        },
      });
    }

    if (data.exception && lineExceptions.length === 0) {
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
