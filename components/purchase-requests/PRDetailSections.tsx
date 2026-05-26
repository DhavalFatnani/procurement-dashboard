import { ExecutionType } from "@prisma/client";
import Link from "next/link";

import type { PRDetail } from "@/app/actions/purchase-requests";
import { ProgressTracker } from "@/components/shared/ProgressTracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatSerialBatchLabel,
} from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

const PROGRESS_STEPS = [
  { key: "prApproved", label: "PR approved", atKey: "prApprovedAt" },
  { key: "poCreated", label: "PO created", atKey: "poCreatedAt" },
  { key: "grnRecorded", label: "GRN recorded", atKey: "grnRecordedAt" },
  { key: "invoiceUploaded", label: "Invoice uploaded", atKey: "invoiceUploadedAt" },
  { key: "paymentReceived", label: "Payment received", atKey: "paymentReceivedAt" },
] as const;

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

export function PRDetailPrintSection({ pr }: { pr: PRDetail }) {
  if (pr.executionType !== ExecutionType.INTERNAL_PRINT || !pr.serialReservation) {
    return null;
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Print execution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-ds-sm">
        <p>
          <span className="text-muted-foreground">Series: </span>
          <span className="font-mono">{pr.serialReservation.series}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Reserved range: </span>
          <span className="font-mono">
            {pr.serialReservation.rangeStart} → {pr.serialReservation.rangeEnd}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">Quantity printed: </span>
          {pr.serialReservation.quantity}
        </p>
        <p>
          <span className="text-muted-foreground">Printed by: </span>
          {pr.serialReservation.createdByName}
        </p>
        <p>
          <span className="text-muted-foreground">Printed on: </span>
          {formatDateTimeMedium(pr.serialReservation.createdAt)}
        </p>
        <Link
          href={`/serial-governance?tab=activity&batch=${pr.serialReservation.id}`}
          className="inline-block text-ds-sm text-primary underline-offset-4 hover:underline"
        >
          View{" "}
          {formatSerialBatchLabel({
            seriesName: pr.serialReservation.series,
            rangeStart: pr.serialReservation.rangeStart,
            rangeEnd: pr.serialReservation.rangeEnd,
            quantity: pr.serialReservation.quantity,
          })}{" "}
          in Serial Governance →
        </Link>
        <Link
          href={`/purchase-requests/${pr.id}/print`}
          className="block text-ds-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Open print execution →
        </Link>
      </CardContent>
    </Card>
  );
}

export function PRDetailVersionHistory({ pr }: { pr: PRDetail }) {
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
