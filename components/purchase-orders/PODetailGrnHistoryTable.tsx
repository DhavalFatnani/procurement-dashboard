"use client";

import { ChevronDown, ChevronUp, PackagePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { GrnLineExceptionSummary } from "@/components/goods-receipt/GrnReceiptLineList";
import { Chip } from "@/components/shared/Chip";
import { formatGrnReceiptLabel } from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import type { PODetail, POGRNLineRow, POGRNRow } from "@/lib/queries/purchase-orders";
import { cn } from "@/lib/utils";

export function PODetailGrnHistoryTable({
  po,
  canRecordGrn,
  expandedGrnId,
  onExpandedGrnChange,
  highlightGrnId,
}: {
  po: PODetail;
  canRecordGrn: boolean;
  expandedGrnId: string | null;
  onExpandedGrnChange: (grnId: string | null) => void;
  highlightGrnId?: string | null;
}) {
  const router = useRouter();
  const recordGrnHref = `/goods-receipt/new?poId=${encodeURIComponent(po.id)}`;

  React.useEffect(() => {
    if (canRecordGrn) {
      router.prefetch(recordGrnHref);
    }
  }, [canRecordGrn, recordGrnHref, router]);

  React.useEffect(() => {
    if (highlightGrnId) {
      onExpandedGrnChange(highlightGrnId);
    }
  }, [highlightGrnId, onExpandedGrnChange]);

  return (
    <SurfaceCard
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <SurfaceCardTitle>GRN history</SurfaceCardTitle>
            <SurfaceCardDescription>
              {po.grns.length === 0
                ? "No receipts recorded yet."
                : `${po.grns.length} ${po.grns.length === 1 ? "receipt" : "receipts"} — read-only timeline. Resolve disputes in Open disputes above.`}
            </SurfaceCardDescription>
          </div>
          {canRecordGrn ? (
            <Button
              size="sm"
              render={<Link href={recordGrnHref} />}
              className="gap-1.5"
            >
              <PackagePlus className="size-3.5" strokeWidth={1.5} aria-hidden />
              Record GRN
            </Button>
          ) : null}
        </div>
      }
    >
      {po.grns.length === 0 ? (
        <EmptyState
          variant="default"
          title="No goods receipts yet"
          description="Record the first GRN to start tracking receipt against this PO."
          action={
            canRecordGrn ? (
              <Button render={<Link href={recordGrnHref} />}>Record GRN</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-card shadow-ds">
          <Table>
            <TableHeader>
              <TableRow className="border-border-subtle bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-9 w-8 px-2" aria-label="Expand" />
                <TableHead className="h-9 px-3 text-ds-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Receipt
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-ds-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Received
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-ds-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Accepted
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-ds-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Disputed
                </TableHead>
                <TableHead className="h-9 px-3 text-ds-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.grns.map((g) => {
                const expanded = expandedGrnId === g.id;
                const lineExceptionIds = new Set(
                  g.lines.map((line) => line.exception?.id).filter(Boolean),
                );
                const grnLevelOpenExceptions = g.openExceptions.filter(
                  (ex) => !lineExceptionIds.has(ex.id),
                );
                return (
                  <React.Fragment key={g.id}>
                    <TableRow
                      data-grn-id={g.id}
                      className={cn(
                        "cursor-pointer border-border-subtle bg-card hover:bg-muted/50",
                        highlightGrnId === g.id && "bg-[var(--status-warning-bg)]/30",
                      )}
                      onClick={() => onExpandedGrnChange(expanded ? null : g.id)}
                    >
                      <TableCell className="w-8 px-2 py-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          {expanded ? (
                            <ChevronUp className="size-3.5" strokeWidth={1.75} aria-hidden />
                          ) : (
                            <ChevronDown className="size-3.5" strokeWidth={1.75} aria-hidden />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-ds-sm">
                        <span className="font-medium">
                          {formatGrnReceiptLabel(po.id, g.receivedAt, g.receivedByName)}
                        </span>
                        <span className="mt-0.5 block text-ds-xs text-muted-foreground">
                          {g.receivedByName} · {formatDateTimeMedium(g.receivedAt)}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-tabular text-ds-sm">
                        {g.receivedQty}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-tabular text-ds-sm text-status-success">
                        {g.acceptedQty}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-tabular text-ds-sm">
                        {g.disputedQty > 0 ? (
                          <span className="text-status-warning">{g.disputedQty}</span>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <GrnStatusChip grn={g} />
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow className="border-border-subtle bg-secondary/20 hover:bg-secondary/20">
                        <TableCell colSpan={6} className="p-0">
                          <ExpandedGrnLines
                            grn={g}
                            grnLevelOpenExceptions={grnLevelOpenExceptions}
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SurfaceCard>
  );
}

function GrnStatusChip({ grn }: { grn: POGRNRow }) {
  if (grn.hasOpenDispute) {
    return (
      <Chip tone="error" size="sm" showDot>
        Open dispute
      </Chip>
    );
  }
  if (grn.disputedQty > 0) {
    return (
      <Chip tone="neutral" size="sm">
        Resolved
      </Chip>
    );
  }
  return (
    <Chip tone="success" size="sm">
      Clear
    </Chip>
  );
}

function ExpandedGrnLines({
  grn,
  grnLevelOpenExceptions,
}: {
  grn: POGRNRow;
  grnLevelOpenExceptions: POGRNRow["openExceptions"];
}) {
  if (grn.lines.length === 0 && grnLevelOpenExceptions.length === 0) {
    return (
      <p className="px-4 py-3 text-ds-sm text-muted-foreground">
        No line detail recorded for this receipt.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {grnLevelOpenExceptions.map((ex) => (
        <div
          key={ex.id}
          className="space-y-2 rounded-xl bg-card px-3 py-3 text-ds-sm shadow-ds"
        >
          <p className="font-medium">Receipt-level exception</p>
          <p className="text-ds-xs text-status-warning">
            Link disputes to PO lines when recording GRNs. This legacy exception cannot
            be resolved in-app — record a correcting GRN or contact support.
          </p>
          <GrnLineExceptionSummary exception={ex} />
        </div>
      ))}
      {grn.lines.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-card">
          <table className="w-full text-ds-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-ds-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Line</th>
                <th className="px-3 py-2 font-medium text-right">Received</th>
                <th className="px-3 py-2 font-medium text-right">Accepted</th>
                <th className="px-3 py-2 font-medium text-right">Disputed</th>
                <th className="px-3 py-2 font-medium">Exception</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((line) => (
                <ExpandedGrnLineRow key={line.poLineItemId} line={line} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ExpandedGrnLineRow({ line }: { line: POGRNLineRow }) {
  const ex = line.exception;
  const lineLabel = `Line ${line.lineNumber}${line.lineItemNumber > 1 ? `.${line.lineItemNumber}` : ""}: ${line.label}`;

  return (
    <tr className="border-b border-border-subtle last:border-0">
      <td className="px-3 py-2">
        <span className="font-medium">{lineLabel}</span>
      </td>
      <td className="px-3 py-2 text-right font-tabular">{line.receivedQty}</td>
      <td className="px-3 py-2 text-right font-tabular text-status-success">
        {line.acceptedQty}
      </td>
      <td className="px-3 py-2 text-right font-tabular">
        {line.disputedQty > 0 ? (
          <span className="text-status-warning">{line.disputedQty}</span>
        ) : (
          "0"
        )}
      </td>
      <td className="px-3 py-2">
        {ex ? (
          <GrnLineExceptionSummary exception={ex} className="p-2" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
