import {
  GRNExceptionOutcome,
  GRNExceptionType,
} from "@/lib/prisma-enums";
import { Prisma } from "@/lib/prisma-client";

import { ensureDisputedCatalogVariant } from "@/lib/disputed-catalog";
import {
  allowsRepricedAccept,
  requiresDisputedCatalogVariant,
  resolutionNoteRequired,
} from "@/lib/grn-exception-outcomes";
import type { NormalizedResolveInput, ResolveGrnExceptionInput } from "@/lib/grn-resolution-types";
import {
  outcomeToLegacyCloseLine,
  outcomeToLegacyDisposition,
} from "@/lib/grn-exception-outcomes";
import {
  deriveResolutionStatus,
  dispositionToPrisma,
  normalizeResolveInput,
} from "@/lib/grn-resolution-types";
import { roundMoney } from "@/lib/po-gst";

export type GrnResolutionTx = Pick<
  Prisma.TransactionClient,
  | "gRNException"
  | "goodsReceipt"
  | "goodsReceiptLineItem"
  | "goodsReceiptLine"
  | "purchaseOrderLineAdjustment"
  | "purchaseOrderLineItem"
  | "catalogItem"
  | "purchaseOrder"
>;

type ExceptionWithGrn = {
  id: string;
  grnId: string;
  poLineItemId: string | null;
  poLineId: string | null;
  exceptionType: GRNExceptionType;
  exceptionQty: number;
  resolutionStatus: string | null;
  grn: {
    id: string;
    poId: string;
    lineItems: {
      id: string;
      poLineItemId: string;
      receivedQty: number;
      acceptedQty: number;
      disputedQty: number;
      purchaseOrderLineItem: {
        id: string;
        poId: string;
        catalogItemId: string;
        categoryId: string;
        subcategoryId: string;
        orderedQty: number;
        unitPrice: Prisma.Decimal;
      };
    }[];
    lines: {
      id: string;
      poLineId: string;
      receivedQty: number;
      acceptedQty: number;
      disputedQty: number;
      purchaseOrderLine: { id: string; orderedQty: number; unitPrice: Prisma.Decimal };
    }[];
  };
};

export function validateResolveGrnExceptionInput(
  exceptionType: GRNExceptionType,
  input: ResolveGrnExceptionInput,
): { ok: true; normalized: NormalizedResolveInput } | { ok: false; message: string } {
  const normalized = normalizeResolveInput(input, exceptionType);
  if ("ok" in normalized && normalized.ok === false) {
    return normalized;
  }

  const n = normalized as NormalizedResolveInput;

  if (resolutionNoteRequired(n.outcome) && !n.note?.trim()) {
    return { ok: false, message: "Resolution note is required for this outcome." };
  }

  if (n.outcome === GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE) {
    if (!allowsRepricedAccept(exceptionType)) {
      return {
        ok: false,
        message: "Repriced accept is only allowed for damaged or quality rejection disputes.",
      };
    }
    const price = n.disputedUnitPrice;
    if (price == null || !Number.isFinite(price) || price <= 0) {
      return { ok: false, message: "Enter the agreed unit price for disputed quantity." };
    }
  }

  return { ok: true, normalized: n };
}

async function rollupGrnHeaderTotals(
  tx: GrnResolutionTx,
  grnId: string,
  useLineItems: boolean,
) {
  if (useLineItems) {
    const lines = await tx.goodsReceiptLineItem.findMany({
      where: { grnId },
      select: { receivedQty: true, acceptedQty: true, disputedQty: true },
    });
    const receivedQty = lines.reduce((s, l) => s + l.receivedQty, 0);
    const acceptedQty = lines.reduce((s, l) => s + l.acceptedQty, 0);
    const disputedQty = lines.reduce((s, l) => s + l.disputedQty, 0);
    await tx.goodsReceipt.update({
      where: { id: grnId },
      data: { receivedQty, acceptedQty, disputedQty },
    });
    return;
  }
  const lines = await tx.goodsReceiptLine.findMany({
    where: { grnId },
    select: { receivedQty: true, acceptedQty: true, disputedQty: true },
  });
  const receivedQty = lines.reduce((s, l) => s + l.receivedQty, 0);
  const acceptedQty = lines.reduce((s, l) => s + l.acceptedQty, 0);
  const disputedQty = lines.reduce((s, l) => s + l.disputedQty, 0);
  await tx.goodsReceipt.update({
    where: { id: grnId },
    data: { receivedQty, acceptedQty, disputedQty },
  });
}

async function sumAcceptedOnLineItem(
  tx: GrnResolutionTx,
  poLineItemId: string,
  poId: string,
): Promise<number> {
  const rows = await tx.goodsReceiptLineItem.findMany({
    where: {
      poLineItemId,
      goodsReceipt: { poId },
    },
    select: { acceptedQty: true },
  });
  return rows.reduce((s, r) => s + r.acceptedQty, 0);
}

async function sumAcceptedOnLegacyLine(
  tx: GrnResolutionTx,
  poLineId: string,
  poId: string,
): Promise<number> {
  const rows = await tx.goodsReceiptLine.findMany({
    where: {
      poLineId,
      goodsReceipt: { poId },
    },
    select: { acceptedQty: true },
  });
  return rows.reduce((s, r) => s + r.acceptedQty, 0);
}

async function removeDisputedFromReceipt(
  tx: GrnResolutionTx,
  useLineItems: boolean,
  grnLineItem: ExceptionWithGrn["grn"]["lineItems"][0] | undefined,
  grnLine: ExceptionWithGrn["grn"]["lines"][0] | undefined,
  disputedOnLine: number,
) {
  if (disputedOnLine <= 0) {
    return;
  }
  if (useLineItems && grnLineItem) {
    const newReceived = grnLineItem.receivedQty - disputedOnLine;
    if (newReceived < grnLineItem.acceptedQty) {
      throw new Error("Removal quantity would make received less than accepted.");
    }
    await tx.goodsReceiptLineItem.update({
      where: { id: grnLineItem.id },
      data: {
        receivedQty: newReceived,
        disputedQty: 0,
      },
    });
    return;
  }
  if (grnLine) {
    const newReceived = grnLine.receivedQty - disputedOnLine;
    if (newReceived < grnLine.acceptedQty) {
      throw new Error("Removal quantity would make received less than accepted.");
    }
    await tx.goodsReceiptLine.update({
      where: { id: grnLine.id },
      data: {
        receivedQty: newReceived,
        disputedQty: 0,
      },
    });
  }
}

async function acceptDisputedOnGrnLine(
  tx: GrnResolutionTx,
  useLineItems: boolean,
  grnLineItemId: string | undefined,
  grnLineId: string | undefined,
  disputedOnLine: number,
) {
  if (disputedOnLine <= 0) {
    throw new Error("No disputed quantity on this line to accept.");
  }
  if (useLineItems && grnLineItemId) {
    const row = await tx.goodsReceiptLineItem.findUnique({
      where: { id: grnLineItemId },
    });
    if (!row) {
      throw new Error("GRN line item not found.");
    }
    await tx.goodsReceiptLineItem.update({
      where: { id: grnLineItemId },
      data: {
        acceptedQty: row.acceptedQty + disputedOnLine,
        disputedQty: 0,
      },
    });
    return;
  }
  if (grnLineId) {
    const row = await tx.goodsReceiptLine.findUnique({ where: { id: grnLineId } });
    if (!row) {
      throw new Error("GRN line not found.");
    }
    await tx.goodsReceiptLine.update({
      where: { id: grnLineId },
      data: {
        acceptedQty: row.acceptedQty + disputedOnLine,
        disputedQty: 0,
      },
    });
  }
}

async function applyAcceptAtDisputedPrice(
  tx: GrnResolutionTx,
  exception: ExceptionWithGrn,
  grnLineItem: ExceptionWithGrn["grn"]["lineItems"][0],
  disputedOnLine: number,
  disputedUnitPrice: number,
  note: string,
  resolvedById: string,
): Promise<void> {
  const basePoLine = grnLineItem.purchaseOrderLineItem;
  const disputedCatalogId = await ensureDisputedCatalogVariant(
    tx,
    basePoLine.catalogItemId,
    resolvedById,
    `Auto-created from GRN exception ${exception.id} · ${exception.exceptionType} · PO ${exception.grn.poId}`,
  );

  const existingSplit = await tx.purchaseOrderLineItem.findUnique({
    where: { originatingGrnExceptionId: exception.id },
  });
  if (existingSplit) {
    throw new Error("Dispute split line already exists for this exception.");
  }

  const splitLine = await tx.purchaseOrderLineItem.create({
    data: {
      poId: basePoLine.poId,
      prLineItemId: null,
      catalogItemId: disputedCatalogId,
      categoryId: basePoLine.categoryId,
      subcategoryId: basePoLine.subcategoryId,
      orderedQty: disputedOnLine,
      unitPrice: new Prisma.Decimal(roundMoney(disputedUnitPrice)),
      sourcePoLineItemId: basePoLine.id,
      originatingGrnExceptionId: exception.id,
    },
  });

  const baseEffectiveOrdered = basePoLine.orderedQty - disputedOnLine;
  if (baseEffectiveOrdered < 0) {
    throw new Error("Disputed quantity exceeds ordered quantity on base line.");
  }

  await tx.purchaseOrderLineAdjustment.create({
    data: {
      poId: exception.grn.poId,
      poLineItemId: basePoLine.id,
      poLineId: null,
      grnExceptionId: exception.id,
      originalOrderedQty: basePoLine.orderedQty,
      effectiveOrderedQty: baseEffectiveOrdered,
      originalUnitPrice: basePoLine.unitPrice,
      effectiveUnitPrice: basePoLine.unitPrice,
      reason: note || "Disputed qty split to settlement line",
      createdById: resolvedById,
    },
  });

  await tx.goodsReceiptLineItem.create({
    data: {
      grnId: exception.grnId,
      poLineItemId: splitLine.id,
      receivedQty: disputedOnLine,
      acceptedQty: disputedOnLine,
      disputedQty: 0,
    },
  });

  await tx.goodsReceiptLineItem.update({
    where: { id: grnLineItem.id },
    data: {
      acceptedQty: grnLineItem.acceptedQty,
      disputedQty: 0,
      receivedQty: grnLineItem.acceptedQty,
    },
  });

  await tx.gRNException.update({
    where: { id: exception.id },
    data: { disputeVariantCatalogItemId: disputedCatalogId },
  });
}

export async function applyGrnExceptionResolutionInTransaction(
  tx: GrnResolutionTx,
  exception: ExceptionWithGrn,
  input: ResolveGrnExceptionInput,
  resolvedById: string,
): Promise<void> {
  if (exception.resolutionStatus != null) {
    throw new Error("This exception is already resolved.");
  }

  const validated = validateResolveGrnExceptionInput(exception.exceptionType, input);
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  const n = validated.normalized;
  const useLineItems = exception.grn.lineItems.length > 0;
  const grnLineItem = exception.poLineItemId
    ? exception.grn.lineItems.find((l) => l.poLineItemId === exception.poLineItemId)
    : null;
  const grnLine = exception.poLineId
    ? exception.grn.lines.find((l) => l.poLineId === exception.poLineId)
    : null;

  if (!grnLineItem && !grnLine) {
    throw new Error(
      "Receipt-level exceptions must be resolved from a line-linked dispute. Re-record the GRN with per-line exceptions.",
    );
  }

  if (
    n.outcome === GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE &&
    (!useLineItems || !grnLineItem || !exception.poLineItemId)
  ) {
    throw new Error("Repriced accept requires catalog line-item receipts.");
  }

  const poLine = grnLineItem?.purchaseOrderLineItem ?? grnLine!.purchaseOrderLine;
  const disputedOnLine = grnLineItem?.disputedQty ?? grnLine!.disputedQty;
  const note = n.note?.trim() ?? "";

  switch (n.outcome) {
    case GRNExceptionOutcome.ACCEPT_AT_PO_PRICE:
      await acceptDisputedOnGrnLine(
        tx,
        useLineItems,
        grnLineItem?.id,
        grnLine?.id,
        disputedOnLine,
      );
      break;

    case GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE:
      if (!requiresDisputedCatalogVariant(n.outcome, exception.exceptionType)) {
        throw new Error("Repriced accept not allowed for this exception type.");
      }
      await applyAcceptAtDisputedPrice(
        tx,
        exception,
        grnLineItem!,
        disputedOnLine,
        n.disputedUnitPrice!,
        note,
        resolvedById,
      );
      break;

    case GRNExceptionOutcome.RETURN_AND_SETTLE:
      await removeDisputedFromReceipt(
        tx,
        useLineItems,
        grnLineItem ?? undefined,
        grnLine ?? undefined,
        disputedOnLine,
      );
      {
        let acceptedTotal: number;
        if (useLineItems && exception.poLineItemId) {
          acceptedTotal = await sumAcceptedOnLineItem(
            tx,
            exception.poLineItemId,
            exception.grn.poId,
          );
        } else if (exception.poLineId) {
          acceptedTotal = await sumAcceptedOnLegacyLine(
            tx,
            exception.poLineId,
            exception.grn.poId,
          );
        } else {
          throw new Error("Line reference missing for return settlement.");
        }
        await tx.purchaseOrderLineAdjustment.create({
          data: {
            poId: exception.grn.poId,
            poLineItemId: exception.poLineItemId,
            poLineId: exception.poLineId,
            grnExceptionId: exception.id,
            originalOrderedQty: poLine.orderedQty,
            effectiveOrderedQty: acceptedTotal,
            originalUnitPrice: poLine.unitPrice,
            effectiveUnitPrice: poLine.unitPrice,
            reason: note || "Return and settle — PO commitment reduced to accepted qty",
            createdById: resolvedById,
          },
        });
      }
      break;

    case GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN:
      await removeDisputedFromReceipt(
        tx,
        useLineItems,
        grnLineItem ?? undefined,
        grnLine ?? undefined,
        disputedOnLine,
      );
      break;
  }

  await rollupGrnHeaderTotals(tx, exception.grnId, useLineItems);

  const legacyDisposition = outcomeToLegacyDisposition(n.outcome);
  const resolutionStatus = deriveResolutionStatus(n.outcome);

  await tx.gRNException.update({
    where: { id: exception.id },
    data: {
      resolutionStatus,
      resolutionOutcome: n.outcome,
      resolutionDisposition: dispositionToPrisma(legacyDisposition),
      closeLineAfterResolve: outcomeToLegacyCloseLine(n.outcome),
      pendingReplacementQty:
        n.outcome === GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN
          ? disputedOnLine
          : null,
      resolvedById,
      resolvedAt: new Date(),
      resolutionNote: note || null,
    },
  });
}

export const GRN_EXCEPTION_RESOLVE_INCLUDE = {
  grn: {
    include: {
      lineItems: {
        include: {
          purchaseOrderLineItem: {
            select: {
              id: true,
              poId: true,
              catalogItemId: true,
              categoryId: true,
              subcategoryId: true,
              orderedQty: true,
              unitPrice: true,
            },
          },
        },
      },
      lines: {
        include: {
          purchaseOrderLine: {
            select: { id: true, orderedQty: true, unitPrice: true },
          },
        },
      },
    },
  },
} as const;
