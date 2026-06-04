import type { Prisma } from "@/lib/generated/prisma/client";

import { GRNExceptionOutcome } from "@/lib/prisma-enums";
import { roundMoney } from "@/lib/po-gst";

export type POLineAdjustmentRow = {
  poLineItemId: string | null;
  poLineId: string | null;
  originalOrderedQty: number;
  effectiveOrderedQty: number;
  originalUnitPrice: unknown;
  effectiveUnitPrice: unknown;
  createdAt: Date | string;
  resolutionOutcome?: GRNExceptionOutcome | null;
};

export type EffectivePOLine = {
  lineKey: string;
  originalOrderedQty: number;
  effectiveOrderedQty: number;
  originalUnitPrice: number;
  effectiveUnitPrice: number;
  /** Ordered qty reduced via accept-at-new-price split — not an unresolved short-ship. */
  isDisputeQtySplit: boolean;
};

function lineKeyFromAdjustment(row: POLineAdjustmentRow): string | null {
  if (row.poLineItemId) {
    return `item:${row.poLineItemId}`;
  }
  if (row.poLineId) {
    return `line:${row.poLineId}`;
  }
  return null;
}

/** Latest adjustment per PO line wins. */
export function buildEffectiveLineMap(
  adjustments: POLineAdjustmentRow[],
): Map<string, EffectivePOLine> {
  const sorted = [...adjustments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const map = new Map<string, EffectivePOLine>();
  for (const row of sorted) {
    const key = lineKeyFromAdjustment(row);
    if (!key) {
      continue;
    }
    map.set(key, {
      lineKey: key,
      originalOrderedQty: row.originalOrderedQty,
      effectiveOrderedQty: row.effectiveOrderedQty,
      originalUnitPrice: Number(row.originalUnitPrice),
      effectiveUnitPrice: Number(row.effectiveUnitPrice),
      isDisputeQtySplit:
        row.resolutionOutcome === GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE,
    });
  }
  return map;
}

/** Flatten Prisma lineAdjustments (with nested grnException) for effective-qty helpers. */
export function normalizePoLineAdjustments<
  T extends POLineAdjustmentRow & {
    grnException?: { resolutionOutcome: GRNExceptionOutcome | null } | null;
  },
>(rows: T[]): POLineAdjustmentRow[] {
  return rows.map(({ grnException, ...row }) => ({
    ...row,
    resolutionOutcome: grnException?.resolutionOutcome ?? row.resolutionOutcome ?? null,
  }));
}

export function effectiveOrderedQtyForLineItem(
  poLineItemId: string,
  orderedQty: number,
  effectiveMap: Map<string, EffectivePOLine>,
): number {
  return effectiveMap.get(`item:${poLineItemId}`)?.effectiveOrderedQty ?? orderedQty;
}

export function effectiveOrderedQtyForLegacyLine(
  poLineId: string,
  orderedQty: number,
  effectiveMap: Map<string, EffectivePOLine>,
): number {
  return effectiveMap.get(`line:${poLineId}`)?.effectiveOrderedQty ?? orderedQty;
}

export function effectiveUnitPriceForLineItem(
  poLineItemId: string,
  unitPrice: number,
  effectiveMap: Map<string, EffectivePOLine>,
): number {
  return effectiveMap.get(`item:${poLineItemId}`)?.effectiveUnitPrice ?? unitPrice;
}

export function effectiveUnitPriceForLegacyLine(
  poLineId: string,
  unitPrice: number,
  effectiveMap: Map<string, EffectivePOLine>,
): number {
  return effectiveMap.get(`line:${poLineId}`)?.effectiveUnitPrice ?? unitPrice;
}

export function sumEffectiveOrderedQty(
  lineItems: { id: string; orderedQty: number }[],
  legacyLines: { id: string; orderedQty: number }[],
  effectiveMap: Map<string, EffectivePOLine>,
  legacyHeaderOrderedQty: number | null,
): number {
  if (lineItems.length > 0) {
    return lineItems.reduce(
      (sum, line) =>
        sum + effectiveOrderedQtyForLineItem(line.id, line.orderedQty, effectiveMap),
      0,
    );
  }
  if (legacyLines.length > 0) {
    return legacyLines.reduce(
      (sum, line) =>
        sum + effectiveOrderedQtyForLegacyLine(line.id, line.orderedQty, effectiveMap),
      0,
    );
  }
  return legacyHeaderOrderedQty ?? 0;
}

export function computeCommittedSubtotalFromEffectiveLines(
  lineItems: { id: string; orderedQty: number; unitPrice: unknown }[],
  legacyLines: { id: string; orderedQty: number; unitPrice: unknown }[],
  effectiveMap: Map<string, EffectivePOLine>,
): number {
  if (lineItems.length > 0) {
    return roundMoney(
      lineItems.reduce((sum, line) => {
        const qty = effectiveOrderedQtyForLineItem(line.id, line.orderedQty, effectiveMap);
        const price = effectiveUnitPriceForLineItem(
          line.id,
          Number(line.unitPrice),
          effectiveMap,
        );
        return sum + qty * price;
      }, 0),
    );
  }
  if (legacyLines.length > 0) {
    return roundMoney(
      legacyLines.reduce((sum, line) => {
        const qty = effectiveOrderedQtyForLegacyLine(line.id, line.orderedQty, effectiveMap);
        const price = effectiveUnitPriceForLegacyLine(
          line.id,
          Number(line.unitPrice),
          effectiveMap,
        );
        return sum + qty * price;
      }, 0),
    );
  }
  return 0;
}

export async function countOpenGrnExceptionsOnPo(
  db: Pick<Prisma.TransactionClient, "gRNException">,
  poId: string,
): Promise<number> {
  return db.gRNException.count({
    where: {
      grn: { poId },
      resolutionStatus: null,
    },
  });
}
