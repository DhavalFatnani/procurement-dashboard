import { POStatus } from "@/lib/prisma-enums";

import type { GrnExceptionSnapshot } from "@/lib/grn-exception-lines";
import {
  buildEffectiveLineMap,
  effectiveOrderedQtyForLegacyLine,
  effectiveOrderedQtyForLineItem,
  type POLineAdjustmentRow,
} from "@/lib/po-line-effective";
import { roundMoney } from "@/lib/po-gst";

export type POReceiptContext = {
  grnId: string;
  receiptLabel: string;
  receivedQty: number;
  acceptedQty: number;
  disputedQty: number;
  exceptionQty: number;
};

export type POReceivingLineInput = {
  lineKey: string;
  lineId: string;
  lineNumber: number;
  lineItemNumber: number;
  label: string;
  originalOrderedQty: number;
  acceptedQty: number;
  unitPrice: string;
  openException: GrnExceptionSnapshot | null;
  grnIdsWithOpenDispute: string[];
  receiptContext: POReceiptContext | null;
};

export type POReceivingLineRow = {
  lineKey: string;
  lineId: string;
  lineNumber: number;
  lineItemNumber: number;
  label: string;
  originalOrderedQty: number;
  effectiveOrderedQty: number;
  acceptedQty: number;
  pendingQty: number;
  /** Original → effective ordered (e.g. return/settle or dispute split). */
  hasOrderedQtyReduction: boolean;
  /** Unresolved vendor short-ship — not a repriced dispute split awaiting receipt. */
  hasShortShip: boolean;
  unitPrice: string;
  effectiveUnitPrice: string;
  hasPriceAdjustment: boolean;
  lineValueAtEffective: number;
  openException: GrnExceptionSnapshot | null;
  /** First GRN containing the open exception, for scroll/highlight. */
  highlightGrnId: string | null;
  receiptContext: POReceiptContext | null;
};

const RECEIVING_STATUSES: POStatus[] = [
  POStatus.OPEN,
  POStatus.PARTIALLY_RECEIVED,
];

function effectiveUnitPriceForLine(
  lineKey: string,
  unitPrice: string,
  effectiveMap: ReturnType<typeof buildEffectiveLineMap>,
): { effectiveUnitPrice: string; hasPriceAdjustment: boolean } {
  const adj = effectiveMap.get(lineKey);
  if (!adj) {
    return { effectiveUnitPrice: unitPrice, hasPriceAdjustment: false };
  }
  const effective = String(adj.effectiveUnitPrice);
  const original = String(adj.originalUnitPrice);
  return {
    effectiveUnitPrice: effective,
    hasPriceAdjustment: effective !== original,
  };
}

export function buildReceivingLineRows(
  lines: POReceivingLineInput[],
  adjustments: POLineAdjustmentRow[],
  poStatus: POStatus,
): POReceivingLineRow[] {
  const effectiveMap = buildEffectiveLineMap(adjustments);
  const canReceive = RECEIVING_STATUSES.includes(poStatus);

  return lines.map((line) => {
    const isItem = line.lineKey.startsWith("item:");
    const effectiveOrderedQty = isItem
      ? effectiveOrderedQtyForLineItem(
          line.lineId,
          line.originalOrderedQty,
          effectiveMap,
        )
      : effectiveOrderedQtyForLegacyLine(
          line.lineId,
          line.originalOrderedQty,
          effectiveMap,
        );

    const pendingQty = canReceive
      ? Math.max(0, effectiveOrderedQty - line.acceptedQty)
      : 0;

    const { effectiveUnitPrice, hasPriceAdjustment } = effectiveUnitPriceForLine(
      line.lineKey,
      line.unitPrice,
      effectiveMap,
    );

    const effectiveLine = effectiveMap.get(line.lineKey);
    const hasOrderedQtyReduction = effectiveOrderedQty < line.originalOrderedQty;
    const isDisputeQtySplit = effectiveLine?.isDisputeQtySplit ?? false;
    const hasShortShip =
      hasOrderedQtyReduction &&
      line.acceptedQty < effectiveOrderedQty &&
      !isDisputeQtySplit;

    const lineValueAtEffective = roundMoney(
      effectiveOrderedQty * Number(effectiveUnitPrice),
    );

    return {
      lineKey: line.lineKey,
      lineId: line.lineId,
      lineNumber: line.lineNumber,
      lineItemNumber: line.lineItemNumber,
      label: line.label,
      originalOrderedQty: line.originalOrderedQty,
      effectiveOrderedQty,
      acceptedQty: line.acceptedQty,
      pendingQty,
      hasOrderedQtyReduction,
      hasShortShip,
      unitPrice: line.unitPrice,
      effectiveUnitPrice,
      hasPriceAdjustment,
      lineValueAtEffective,
      openException: line.openException,
      highlightGrnId: line.grnIdsWithOpenDispute[0] ?? null,
      receiptContext: line.receiptContext,
    };
  });
}

export function filterAttentionLines(rows: POReceivingLineRow[]): POReceivingLineRow[] {
  return rows.filter(
    (row) =>
      row.openException != null ||
      row.hasShortShip ||
      row.pendingQty > 0,
  );
}

export function openDisputeLines(rows: POReceivingLineRow[]): POReceivingLineRow[] {
  return rows.filter((row) => row.openException != null);
}

export function receivingFollowupLines(rows: POReceivingLineRow[]): POReceivingLineRow[] {
  return rows.filter(
    (row) =>
      row.openException == null && (row.pendingQty > 0 || row.hasShortShip),
  );
}

export function pendingQtyForPo(orderedEffective: number, accepted: number): number {
  return Math.max(0, orderedEffective - accepted);
}

/** Safe read — older cached PO payloads may omit `attentionLines`. */
export function attentionLinesForPo(
  po: { attentionLines?: POReceivingLineRow[] },
): POReceivingLineRow[] {
  return po.attentionLines ?? [];
}
