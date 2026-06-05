import type { LockTagsSerialPreview } from "@/app/actions/serial";
import { ExecutionType, PRStatus, Role } from "@/lib/prisma-enums";
import Link from "next/link";

import type { PRDetail } from "@/lib/queries/purchase-requests";
import { ProgressTracker } from "@/components/shared/ProgressTracker";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatProcurementRef,
  formatSerialBatchLabel,
} from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const PROGRESS_STEPS = [
  { key: "prApproved", label: "PR approved", atKey: "prApprovedAt" },
  { key: "poCreated", label: "PO created", atKey: "poCreatedAt" },
  { key: "grnRecorded", label: "GRN recorded", atKey: "grnRecordedAt" },
  { key: "invoiceUploaded", label: "Invoice uploaded", atKey: "invoiceUploadedAt" },
  { key: "paymentReceived", label: "Payment received", atKey: "paymentReceivedAt" },
] as const;

function internalPrintSeriesName(pr: PRDetail): string {
  return pr.serialReservation?.seriesName ?? pr.subcategoryName;
}

export function PRDetailProgress({ pr }: { pr: PRDetail }) {
  if (pr.executionType !== ExecutionType.VENDOR_PURCHASE) {
    return null;
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Procurement progress</CardTitle>
      </CardHeader>
      <CardContent>
        <ProgressTracker
          variant="dots"
          steps={PROGRESS_STEPS.map((step) => ({
            key: step.key,
            label: step.label,
            done: pr.progress[step.key],
            completedAt: pr.progress[step.atKey],
          }))}
        />
      </CardContent>
    </Card>
  );
}

export function PRDetailLockTagsSerialPreview({
  preview,
  status,
}: {
  preview: LockTagsSerialPreview;
  status: PRStatus;
}) {
  const showPreview =
    status === PRStatus.APPROVED || status === PRStatus.CONVERTED_TO_PO;

  if (!showPreview) {
    return null;
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Lock tag serial preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-ds-sm">
        <p className="text-muted-foreground">
          {preview.isHeld
            ? "This range is held on PR approval and blocked in serial governance. It is confirmed for vendor handoff when a purchase order is created."
            : "Preview only — the range is committed when a purchase order is created. Share the confirmed range with the vendor after PO creation."}
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-ds-xs text-muted-foreground">Series</dt>
            <dd className="mt-1 font-medium">{preview.seriesName}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Quantity</dt>
            <dd className="mt-1 font-medium">{preview.quantity.toLocaleString("en-IN")}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">
              {preview.isHeld ? "Held range" : "Estimated range"}
            </dt>
            <dd className="mt-1 font-mono font-medium">
              {preview.rangeStart} → {preview.rangeEnd}
            </dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Last reserved end</dt>
            <dd className="mt-1 font-mono">{preview.lastRangeEnd ?? "None yet"}</dd>
          </div>
        </dl>
        <Link
          href={`/serial-governance?tab=summary&series=${preview.series}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full sm:w-auto")}
        >
          View series usage in Serial Governance
        </Link>
      </CardContent>
    </Card>
  );
}

export function PRDetailInternalPrintSide({
  pr,
  role,
}: {
  pr: PRDetail;
  role: Role;
}) {
  if (pr.executionType !== ExecutionType.INTERNAL_PRINT || !pr.serialReservation) {
    return null;
  }

  const seriesName = internalPrintSeriesName(pr);
  const isOps = role === Role.OPS_HEAD;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Print job</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-ds-sm">
        <div>
          <p className="text-ds-xs text-muted-foreground">Status</p>
          <div className="mt-1">
            <StatusBadge kind="PRStatus" status={pr.status} />
          </div>
        </div>
        <div>
          <p className="text-ds-xs text-muted-foreground">Batch</p>
          <p className="mt-1 font-medium leading-snug">
            {formatSerialBatchLabel({
              seriesName,
              rangeStart: pr.serialReservation.rangeStart,
              rangeEnd: pr.serialReservation.rangeEnd,
              quantity: pr.serialReservation.quantity,
            })}
          </p>
        </div>
        <div>
          <p className="text-ds-xs text-muted-foreground">Range</p>
          <p className="mt-1 font-mono font-medium">
            {pr.serialReservation.rangeStart} → {pr.serialReservation.rangeEnd}
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Link
            href={`/purchase-requests/${pr.id}/print`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
          >
            View reservation summary
          </Link>
          {isOps ? (
            <Link
              href={`/serial-governance?tab=activity&batch=${pr.serialReservation.id}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
            >
              Open in Serial Governance
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function PRDetailInternalPrintBody({ pr }: { pr: PRDetail }) {
  if (pr.executionType !== ExecutionType.INTERNAL_PRINT) {
    return null;
  }

  const seriesName = internalPrintSeriesName(pr);
  const executed =
    pr.status === PRStatus.EXECUTED_PRINT && pr.serialReservation != null;

  if (executed && pr.serialReservation) {
    const reservation = pr.serialReservation;
    return (
      <Card size="sm">
        <CardContent className="space-y-5 pt-5">
          <div className="flex items-start gap-3 rounded-xl border border-status-success/30 bg-[var(--status-success-bg)] px-4 py-3">
            <CheckCircle2
              className="size-5 shrink-0 text-status-success"
              strokeWidth={1.5}
            />
            <div className="min-w-0 space-y-1">
              <p className="text-ds-sm font-semibold text-foreground">
                Print job complete
              </p>
              <p className="text-ds-sm text-muted-foreground">
                Serial range reserved and labels were sent to the printer. This request does
                not create a PO, GRN, or invoice.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border-subtle bg-muted/20">
            <div className="border-b border-border-subtle bg-card px-4 py-3">
              <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reserved batch
              </p>
              <p className="mt-1 text-ds-sm font-medium">
                {formatSerialBatchLabel({
                  seriesName,
                  rangeStart: reservation.rangeStart,
                  rangeEnd: reservation.rangeEnd,
                  quantity: reservation.quantity,
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-4">
              <div className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-background px-4 py-3 text-center">
                <p className="text-ds-xs text-muted-foreground">Start</p>
                <p className="mt-1 break-all font-mono text-ds-sm font-semibold tabular-nums">
                  {reservation.rangeStart}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <div className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-background px-4 py-3 text-center">
                <p className="text-ds-xs text-muted-foreground">End</p>
                <p className="mt-1 break-all font-mono text-ds-sm font-semibold tabular-nums">
                  {reservation.rangeEnd}
                </p>
              </div>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-ds-xs text-muted-foreground">Series</dt>
              <dd className="mt-1 font-medium">{seriesName}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Subcategory</dt>
              <dd className="mt-1 font-medium">{pr.subcategoryName}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Quantity</dt>
              <dd className="mt-1 font-medium">{reservation.quantity}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Warehouse</dt>
              <dd className="mt-1 font-medium">{pr.warehouseName}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Reserved by</dt>
              <dd className="mt-1">{reservation.createdByName}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Reserved at</dt>
              <dd className="mt-1">{formatDateTimeMedium(reservation.createdAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Internal print request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-ds-sm">
        <p className="text-muted-foreground">
          This request is for in-house barcode printing only — no purchase order or payment
          workflow applies.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-ds-xs text-muted-foreground">Subcategory</dt>
            <dd className="mt-1 font-medium">{pr.subcategoryName}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Quantity</dt>
            <dd className="mt-1 font-medium">{pr.quantity}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Warehouse</dt>
            <dd className="mt-1 font-medium">{pr.warehouseName}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Reference</dt>
            <dd className="mt-1 font-medium">{formatProcurementRef(pr.id)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function PRDetailVersionHistory({ pr }: { pr: PRDetail }) {
  if (pr.executionType === ExecutionType.INTERNAL_PRINT && pr.versions.length === 0) {
    return null;
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Version history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-ds-sm">
        {pr.versions.length === 0 ? (
          <p className="text-muted-foreground">No versions yet.</p>
        ) : (
          pr.versions.map((v) => (
            <div key={v.id} className="border-b border-border-subtle pb-3 last:border-0">
              <p className="font-medium">
                V{v.versionNumber} — {v.actionLabel} by {v.changedByName} on{" "}
                {formatDateTimeMedium(v.changedAt)}
              </p>
              {v.revisionComment ? (
                <p className="mt-1 text-muted-foreground">{v.revisionComment}</p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
