"use client";

import { GRNExceptionResolution, POStatus, Role } from "@prisma/client";
import { ChevronDown, ChevronUp, PackagePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { resolveGRNException } from "@/app/actions/purchase-orders";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GrnLineExceptionSummary } from "@/components/goods-receipt/GrnReceiptLineList";
import { formatGrnReceiptLabel } from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import type { GrnExceptionSnapshot } from "@/lib/grn-exception-lines";
import type { PODetail } from "@/lib/queries/purchase-orders";
import { cn } from "@/lib/utils";

const RECEIVING_STATUSES: POStatus[] = [
  POStatus.OPEN,
  POStatus.PARTIALLY_RECEIVED,
];

export function PODetailFulfillmentTab({
  po,
  role,
}: {
  po: PODetail;
  role: Role;
}) {
  const router = useRouter();
  const isOps = role === Role.OPS_HEAD;
  const canRecordGrn =
    (role === Role.SM || role === Role.OPS_HEAD) &&
    RECEIVING_STATUSES.includes(po.status);
  const recordGrnHref = `/goods-receipt/new?poId=${encodeURIComponent(po.id)}`;

  const [expandedGrn, setExpandedGrn] = React.useState<string | null>(null);
  const [resolution, setResolution] = React.useState<GRNExceptionResolution>(
    GRNExceptionResolution.ACCEPTED,
  );
  const [resolutionNote, setResolutionNote] = React.useState("");
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  async function handleResolveException(exceptionId: string) {
    setResolvingId(exceptionId);
    const res = await resolveGRNException(
      exceptionId,
      resolution,
      resolution === GRNExceptionResolution.OVERRIDE_ACCEPTED
        ? resolutionNote
        : undefined,
    );
    setResolvingId(null);
    if (!res.ok) {
      toast.error(res.message ?? "Failed to resolve exception.");
      return;
    }
    toast.success("Exception resolved.");
    setExpandedGrn(null);
    setResolutionNote("");
    router.refresh();
  }

  return (
    <div className="section-stack">
      <SurfaceCard
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <SurfaceCardTitle>Goods receipts</SurfaceCardTitle>
              <SurfaceCardDescription>
                {po.grns.length === 0
                  ? "No receipts recorded yet."
                  : `${po.grns.length} ${po.grns.length === 1 ? "receipt" : "receipts"} recorded.`}
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
                <Button render={<Link href={recordGrnHref} />}>
                  Record GRN
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-border-subtle">
            {po.grns.map((g) => {
              const expanded = expandedGrn === g.id;
              const lineExceptionIds = new Set(
                g.lines.map((line) => line.exception?.id).filter(Boolean),
              );
              const grnLevelOpenExceptions = g.openExceptions.filter(
                (ex) => !lineExceptionIds.has(ex.id),
              );
              return (
                <div key={g.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-3 text-left text-ds-sm transition-colors hover:bg-secondary/40"
                    onClick={() =>
                      setExpandedGrn(expanded ? null : g.id)
                    }
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      {expanded ? (
                        <ChevronUp
                          className="size-3.5"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      ) : (
                        <ChevronDown
                          className="size-3.5"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium">
                        {formatGrnReceiptLabel(
                          po.id,
                          g.receivedAt,
                          g.receivedByName,
                        )}
                      </span>
                      <span className="text-ds-xs text-muted-foreground">
                        {g.receivedByName} ·{" "}
                        {formatDateTimeMedium(g.receivedAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-2 text-ds-xs">
                      <Stat label="Recv" value={g.receivedQty} />
                      <Stat
                        label="Acc"
                        value={g.acceptedQty}
                        tone={g.acceptedQty > 0 ? "success" : undefined}
                      />
                      <Stat
                        label="Disp"
                        value={g.disputedQty}
                        tone={g.disputedQty > 0 ? "warning" : undefined}
                      />
                      {g.hasOpenDispute ? (
                        <span className="rounded-full bg-[var(--status-error-bg)] px-2 py-0.5 font-medium text-[var(--status-error)]">
                          Open dispute
                        </span>
                      ) : g.disputedQty > 0 ? (
                        <span className="rounded-full bg-[var(--status-neutral-bg)] px-2 py-0.5 font-medium text-muted-foreground">
                          Resolved
                        </span>
                      ) : null}
                    </span>
                  </button>

                  {expanded ? (
                    <div className="space-y-3 border-t border-border-subtle bg-secondary/20 px-2 py-3">
                      {g.lines.length === 0 && grnLevelOpenExceptions.length === 0 ? (
                        <p className="text-ds-sm text-muted-foreground">
                          No line detail recorded for this receipt.
                        </p>
                      ) : null}
                      {grnLevelOpenExceptions.map((ex) => (
                        <div
                          key={ex.id}
                          className="space-y-2 rounded-xl bg-card px-3 py-3 text-ds-sm shadow-ds"
                        >
                          <p className="font-medium">Receipt-level exception</p>
                          <GrnLineExceptionSummary exception={ex} />
                          {ex.resolutionStatus ? null : isOps ? (
                            <ResolveExceptionPanel
                              exception={ex}
                              resolution={resolution}
                              resolutionNote={resolutionNote}
                              resolvingId={resolvingId}
                              onResolutionChange={setResolution}
                              onNoteChange={setResolutionNote}
                              onConfirm={() => void handleResolveException(ex.id)}
                            />
                          ) : (
                            <p className="text-ds-xs text-muted-foreground">
                              Awaiting resolution by Ops Head.
                            </p>
                          )}
                        </div>
                      ))}
                      {g.lines.length > 0 ? (
                        g.lines.map((line) => (
                          <div
                            key={line.poLineItemId}
                            className="space-y-2 rounded-xl bg-card px-3 py-3 text-ds-sm shadow-ds"
                          >
                            <div>
                              <p className="font-medium">
                                Line {line.lineNumber}
                                {line.lineItemNumber > 1
                                  ? `.${line.lineItemNumber}`
                                  : ""}
                                : {line.label}
                              </p>
                              <p className="mt-0.5 text-ds-xs text-muted-foreground">
                                Received {line.receivedQty} · Accepted {line.acceptedQty}
                                {line.disputedQty > 0
                                  ? ` · Disputed ${line.disputedQty}`
                                  : ""}
                              </p>
                            </div>

                            {line.exception ? (
                              <>
                                <GrnLineExceptionSummary exception={line.exception} />
                                {line.exception.resolutionStatus ? null : isOps ? (
                                  <ResolveExceptionPanel
                                    exception={line.exception}
                                    resolution={resolution}
                                    resolutionNote={resolutionNote}
                                    resolvingId={resolvingId}
                                    onResolutionChange={setResolution}
                                    onNoteChange={setResolutionNote}
                                    onConfirm={() =>
                                      void handleResolveException(line.exception!.id)
                                    }
                                  />
                                ) : (
                                  <p className="text-ds-xs text-muted-foreground">
                                    Awaiting resolution by Ops Head.
                                  </p>
                                )}
                              </>
                            ) : null}
                          </div>
                        ))
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      {po.isLockTags && po.serialReservation ? (
        <SurfaceCard
          header={
            <>
              <SurfaceCardTitle>Serial fulfillment</SurfaceCardTitle>
              <SurfaceCardDescription>
                Cross-check physical tags received against the reserved range.
              </SurfaceCardDescription>
            </>
          }
        >
          <div className="grid gap-3 text-ds-sm sm:grid-cols-3">
            <SerialMeta label="Series" value={po.serialReservation.series} />
            <SerialMeta
              label="Range"
              value={`${po.serialReservation.rangeStart} → ${po.serialReservation.rangeEnd}`}
            />
            <SerialMeta
              label="Status"
              value={po.serialReservation.status.replaceAll("_", " ")}
            />
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}

function ResolveExceptionPanel({
  exception,
  resolution,
  resolutionNote,
  resolvingId,
  onResolutionChange,
  onNoteChange,
  onConfirm,
}: {
  exception: GrnExceptionSnapshot;
  resolution: GRNExceptionResolution;
  resolutionNote: string;
  resolvingId: string | null;
  onResolutionChange: (value: GRNExceptionResolution) => void;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-2.5 rounded-lg border border-border-subtle bg-background p-3">
      <p className="text-ds-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Resolve exception
      </p>
      <div className="space-y-1.5">
        {(
          [
            [GRNExceptionResolution.ACCEPTED, "Accept dispute"],
            [GRNExceptionResolution.RETURNED_TO_VENDOR, "Return to vendor"],
            [GRNExceptionResolution.OVERRIDE_ACCEPTED, "Override and accept"],
          ] as const
        ).map(([val, label]) => (
          <label key={val} className="flex items-center gap-2 text-ds-sm">
            <input
              type="radio"
              name={`res-${exception.id}`}
              checked={resolution === val}
              onChange={() => onResolutionChange(val)}
            />
            {label}
          </label>
        ))}
      </div>
      {resolution === GRNExceptionResolution.OVERRIDE_ACCEPTED ? (
        <div className="space-y-1">
          <label
            htmlFor={`note-${exception.id}`}
            className="text-ds-xs font-medium text-foreground"
          >
            Override reason (required)
          </label>
          <Textarea
            id={`note-${exception.id}`}
            value={resolutionNote}
            onChange={(e) => onNoteChange(e.target.value)}
            className="min-h-[72px]"
          />
        </div>
      ) : null}
      <Button size="sm" disabled={resolvingId === exception.id} onClick={onConfirm}>
        Confirm resolution
      </Button>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-tabular font-medium tabular-nums",
          tone === "success" && "text-status-success",
          tone === "warning" && "text-status-warning",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function SerialMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ds-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-tabular text-foreground">{value}</p>
    </div>
  );
}
