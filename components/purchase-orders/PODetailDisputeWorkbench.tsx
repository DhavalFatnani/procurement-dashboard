"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

import { LineCommercialContext } from "@/components/purchase-orders/LineCommercialContext";
import { ResolveGrnExceptionPanel } from "@/components/purchase-orders/ResolveGrnExceptionPanel";
import { Chip } from "@/components/shared/Chip";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import {
  attentionLinesForPo,
  openDisputeLines,
  type POReceivingLineRow,
} from "@/lib/po-receiving-lines";
import type { PODetail } from "@/lib/queries/purchase-orders";
import { cn } from "@/lib/utils";

export function PODetailDisputeWorkbench({
  po,
  isOps,
  expandedExceptionId,
  onExpandedExceptionChange,
  onViewReceipt,
  deepLinkExceptionId,
}: {
  po: PODetail;
  isOps: boolean;
  expandedExceptionId: string | null;
  onExpandedExceptionChange: (exceptionId: string | null) => void;
  onViewReceipt: (grnId: string) => void;
  deepLinkExceptionId?: string | null;
}) {
  const [optimisticallyResolvedIds, setOptimisticallyResolvedIds] = React.useState(
    () => new Set<string>(),
  );
  const cardRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const deepLinkedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setOptimisticallyResolvedIds(new Set());
  }, [po.id]);

  const disputes = openDisputeLines(attentionLinesForPo(po)).filter(
    (row) =>
      row.openException && !optimisticallyResolvedIds.has(row.openException.id),
  );

  const handleResolved = React.useCallback(
    (exceptionId: string) => {
      setOptimisticallyResolvedIds((prev) => new Set(prev).add(exceptionId));
      onExpandedExceptionChange(null);
    },
    [onExpandedExceptionChange],
  );

  React.useEffect(() => {
    if (!deepLinkExceptionId || !isOps) {
      return;
    }
    if (deepLinkedRef.current === deepLinkExceptionId) {
      return;
    }
    const row = disputes.find((r) => r.openException?.id === deepLinkExceptionId);
    if (!row?.openException) {
      return;
    }
    deepLinkedRef.current = deepLinkExceptionId;
    onExpandedExceptionChange(row.openException.id);
    requestAnimationFrame(() => {
      cardRefs.current[row.openException!.id]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }, [deepLinkExceptionId, isOps, disputes, onExpandedExceptionChange]);

  if (disputes.length === 0) {
    return null;
  }

  return (
    <SurfaceCard
      header={
        <>
          <SurfaceCardTitle>Open disputes</SurfaceCardTitle>
          <SurfaceCardDescription>
            Resolve each dispute inline — unit prices and receipt quantities are shown
            before you commit.
          </SurfaceCardDescription>
        </>
      }
    >
      <div className="space-y-2">
        {disputes.map((row) => (
          <DisputeCard
            key={row.lineKey}
            row={row}
            isOps={isOps}
            expanded={expandedExceptionId === row.openException?.id}
            cardRef={(el) => {
              if (row.openException) {
                cardRefs.current[row.openException.id] = el;
              }
            }}
            onToggle={() => {
              const id = row.openException?.id;
              if (!id) {
                return;
              }
              onExpandedExceptionChange(expandedExceptionId === id ? null : id);
            }}
            onViewReceipt={onViewReceipt}
            onResolved={handleResolved}
          />
        ))}
      </div>
    </SurfaceCard>
  );
}

function DisputeCard({
  row,
  isOps,
  expanded,
  cardRef,
  onToggle,
  onViewReceipt,
  onResolved,
}: {
  row: POReceivingLineRow;
  isOps: boolean;
  expanded: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  onToggle: () => void;
  onViewReceipt: (grnId: string) => void;
  onResolved: (exceptionId: string) => void;
}) {
  const ex = row.openException!;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  return (
    <div
      ref={cardRef}
      data-exception-id={ex.id}
      className={cn(
        "rounded-xl border border-border-subtle bg-card shadow-ds transition-colors",
        expanded && "border-[var(--status-warning)]/40 ring-1 ring-[var(--status-warning)]/20",
        isSubmitting && "border-primary/30 ring-1 ring-primary/15",
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 px-3 py-3 text-left disabled:cursor-wait"
        onClick={onToggle}
        disabled={isSubmitting}
        aria-expanded={expanded}
        aria-busy={isSubmitting}
      >
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          {expanded ? (
            <ChevronUp className="size-3.5" strokeWidth={1.75} aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" strokeWidth={1.75} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ds-sm">
              Line {row.lineNumber}
              {row.lineItemNumber > 1 ? `.${row.lineItemNumber}` : ""}: {row.label}
            </span>
            <Chip tone="error" size="sm" showDot>
              {ex.exceptionType.replaceAll("_", " ")}
            </Chip>
          </span>
          <LineCommercialContext row={row} compact />
          {row.receiptContext ? (
            <span className="mt-1 block text-ds-2xs text-muted-foreground">
              {row.receiptContext.receiptLabel}
            </span>
          ) : null}
        </span>
      </button>

      {expanded ? (
        <div className="px-3 pb-3">
          <LineCommercialContext row={row} onViewReceipt={onViewReceipt} />
          {isOps ? (
            <ResolveGrnExceptionPanel
              row={row}
              onResolved={onResolved}
              onCancel={onToggle}
              onSubmittingChange={setIsSubmitting}
            />
          ) : (
            <p className="border-t border-border-subtle pt-3 text-ds-xs text-muted-foreground">
              Awaiting resolution by Ops Head.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
