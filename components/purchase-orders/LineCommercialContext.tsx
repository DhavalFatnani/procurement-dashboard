"use client";

import type { ReactNode } from "react";

import { formatInr } from "@/lib/format-datetime";
import type { POReceivingLineRow } from "@/lib/po-receiving-lines";
import { cn } from "@/lib/utils";

export function LineCommercialContext({
  row,
  compact = false,
  onViewReceipt,
}: {
  row: POReceivingLineRow;
  compact?: boolean;
  onViewReceipt?: (grnId: string) => void;
}) {
  const receipt = row.receiptContext;

  if (compact) {
    return (
      <p className="text-ds-xs text-muted-foreground">
        <QtySummary row={row} />
        {receipt ? (
          <>
            {" "}
            · Disputed {receipt.exceptionQty} on {receipt.receiptLabel}
          </>
        ) : null}
        {" "}
        · {formatInr(String(row.effectiveUnitPrice))}/unit · Line value{" "}
        {formatInr(String(row.lineValueAtEffective))}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-muted/30 px-3 py-3 text-ds-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricGroup title="Quantities">
          <Metric label="Ordered → effective" value={<QtySummary row={row} />} />
          <Metric label="Accepted (PO total)" value={row.acceptedQty} numeric />
          <Metric
            label="Pending"
            value={row.pendingQty}
            numeric
            highlight={row.pendingQty > 0 ? "warning" : undefined}
          />
          {receipt ? (
            <Metric
              label="On this receipt"
              value={`Recv ${receipt.receivedQty} · Acc ${receipt.acceptedQty} · Disp ${receipt.disputedQty}`}
            />
          ) : null}
        </MetricGroup>
        <MetricGroup title="Commercial">
          <Metric
            label="PO unit price"
            value={formatInr(row.unitPrice)}
            numeric
          />
          <Metric
            label="Effective unit price"
            value={
              row.hasPriceAdjustment ? (
                <span className="inline-flex items-baseline gap-1 font-tabular">
                  <span className="text-muted-foreground line-through text-ds-xs">
                    {formatInr(row.unitPrice)}
                  </span>
                  <span>{formatInr(row.effectiveUnitPrice)}</span>
                </span>
              ) : (
                formatInr(row.effectiveUnitPrice)
              )
            }
          />
          <Metric
            label="Line value (effective qty × price)"
            value={formatInr(String(row.lineValueAtEffective))}
            numeric
          />
        </MetricGroup>
      </div>
      {receipt && onViewReceipt ? (
        <button
          type="button"
          className="text-ds-xs font-medium text-primary hover:underline"
          onClick={() => onViewReceipt(receipt.grnId)}
        >
          View {receipt.receiptLabel} in GRN history
        </button>
      ) : null}
    </div>
  );
}

function QtySummary({ row }: { row: POReceivingLineRow }) {
  if (row.hasOrderedQtyReduction) {
    return (
      <span className="font-tabular">
        <span className="text-muted-foreground line-through">{row.originalOrderedQty}</span>
        <span aria-hidden> → </span>
        <span className="font-medium">{row.effectiveOrderedQty}</span>
      </span>
    );
  }
  return <span className="font-tabular">{row.effectiveOrderedQty}</span>;
}

function MetricGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-ds-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  numeric,
  highlight,
}: {
  label: string;
  value: ReactNode;
  numeric?: boolean;
  highlight?: "warning";
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-ds-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          numeric && "font-tabular font-medium",
          highlight === "warning" && "text-status-warning",
        )}
      >
        {value}
      </span>
    </div>
  );
}
