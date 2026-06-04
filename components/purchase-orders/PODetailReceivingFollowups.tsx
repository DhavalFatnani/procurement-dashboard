"use client";

import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/shared/Chip";
import {
  attentionLinesForPo,
  receivingFollowupLines,
} from "@/lib/po-receiving-lines";
import type { PODetail } from "@/lib/queries/purchase-orders";

export function PODetailReceivingFollowups({
  po,
  onViewReceipt,
}: {
  po: PODetail;
  onViewReceipt: (grnId: string) => void;
}) {
  const rows = receivingFollowupLines(attentionLinesForPo(po));
  if (rows.length === 0) {
    return null;
  }

  return (
    <SurfaceCard
      header={
        <>
          <SurfaceCardTitle>Receiving follow-ups</SurfaceCardTitle>
          <SurfaceCardDescription>
            Pending receipt or short-ship adjustments — no open dispute on these lines.
          </SurfaceCardDescription>
        </>
      }
    >
      <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-card">
        {rows.map((row) => (
          <li
            key={row.lineKey}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-ds-sm"
          >
            <div className="min-w-0">
              <p className="font-medium">
                Line {row.lineNumber}
                {row.lineItemNumber > 1 ? `.${row.lineItemNumber}` : ""}: {row.label}
              </p>
              <p className="mt-0.5 text-ds-xs text-muted-foreground">
                Ordered{" "}
                {row.hasOrderedQtyReduction ? (
                  <>
                    <span className="line-through">{row.originalOrderedQty}</span> →{" "}
                    {row.effectiveOrderedQty}
                  </>
                ) : (
                  row.effectiveOrderedQty
                )}{" "}
                · Accepted {row.acceptedQty}
                {row.pendingQty > 0 ? ` · Pending ${row.pendingQty}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {row.hasShortShip ? (
                <Chip tone="warning" size="sm">
                  Short-ship
                </Chip>
              ) : row.pendingQty > 0 ? (
                <Chip tone="neutral" size="sm">
                  Pending
                </Chip>
              ) : null}
              {row.highlightGrnId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewReceipt(row.highlightGrnId!)}
                >
                  View receipt
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </SurfaceCard>
  );
}
