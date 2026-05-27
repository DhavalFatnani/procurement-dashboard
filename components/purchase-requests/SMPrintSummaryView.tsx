"use client";

import { SerialSeries } from "@prisma/client";
import Link from "next/link";
import * as React from "react";

import { SerialBarcodePrintSheet } from "@/components/purchase-requests/SerialBarcodePrintSheet";
import { PageAlert } from "@/components/shared/PageAlert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatProcurementRef, formatSerialBatchLabel } from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import {
  loadBarcodeLabelConfigFromSession,
  type BarcodeLabelConfig,
} from "@/lib/barcode-label-config";
import { getSeriesDisplayName } from "@/lib/serial-series";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Printer } from "lucide-react";

type PrintStatus = "preparing" | "ready" | "printing" | "done";

function LabelPrepLoader({
  status,
  completed,
  total,
}: {
  status: PrintStatus;
  completed: number;
  total: number;
}) {
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const title =
    status === "preparing"
      ? "Preparing barcode labels"
      : status === "printing"
        ? "Opening print dialog"
        : "Labels ready";

  const description =
    status === "preparing"
      ? "Stay on this page while we build your label sheet. The print dialog opens automatically when ready."
      : status === "printing"
        ? "Your browser print dialog should appear momentarily."
        : "Sending labels to the printer…";

  return (
    <Card size="sm" className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="size-5 animate-spin text-primary" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-ds-md font-semibold text-foreground">{title}</p>
            <p className="text-ds-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {status === "preparing" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-ds-xs text-muted-foreground">
              <span>
                {completed} / {total} labels
              </span>
              <span>{progress}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Label preparation progress"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
                style={{ width: `${Math.max(progress, completed > 0 ? 8 : 4)}%` }}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SMPrintSummaryView({
  prId,
  reservation,
  autoPrint,
}: {
  prId: string;
  reservation: {
    id: string;
    series: string;
    rangeStart: string;
    rangeEnd: string;
    quantity: number;
    warehouseName: string;
    createdByName: string;
    createdAt: string;
  };
  autoPrint: boolean;
}) {
  const [printStatus, setPrintStatus] = React.useState<PrintStatus>(
    autoPrint ? "preparing" : "done",
  );
  const [labelProgress, setLabelProgress] = React.useState({ completed: 0, total: reservation.quantity });
  const [mountPrintSheet, setMountPrintSheet] = React.useState(false);
  const [labelConfig] = React.useState<BarcodeLabelConfig>(() =>
    loadBarcodeLabelConfigFromSession(reservation.id),
  );

  React.useEffect(() => {
    if (!autoPrint) {
      return;
    }
    setMountPrintSheet(true);
  }, [autoPrint]);

  const seriesName = getSeriesDisplayName(reservation.series as SerialSeries);
  const batchLabel = formatSerialBatchLabel({
    seriesName,
    rangeStart: reservation.rangeStart,
    rangeEnd: reservation.rangeEnd,
    quantity: reservation.quantity,
  });

  const labelsLoading = autoPrint && printStatus !== "done";

  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="rounded-xl border border-status-success/30 bg-[var(--status-success-bg)] px-5 py-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-status-success" strokeWidth={1.5} />
            <div className="min-w-0 space-y-1">
              <p className="text-ds-md font-semibold text-foreground">
                Serial range reserved successfully
              </p>
              <p className="text-ds-sm text-muted-foreground">{batchLabel}</p>
            </div>
          </div>
        </div>

        {autoPrint ? (
          labelsLoading ? (
            <LabelPrepLoader
              status={printStatus}
              completed={labelProgress.completed}
              total={labelProgress.total}
            />
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-card px-4 py-3">
              <Printer className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
              <div className="space-y-1">
                <p className="text-ds-sm font-medium text-foreground">Barcode labels</p>
                <p className="text-ds-sm text-muted-foreground">
                  Print dialog opened. Apply labels once — reprinting risks duplicate barcodes in
                  use.
                </p>
              </div>
            </div>
          )
        ) : null}

        <Card size="sm">
          <CardHeader>
            <CardTitle>Reservation summary</CardTitle>
          </CardHeader>
          <CardContent className="text-ds-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Series</dt>
                <dd className="mt-1 font-medium">{seriesName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Quantity</dt>
                <dd className="mt-1 font-medium">{reservation.quantity}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Range</dt>
                <dd className="mt-1 font-mono font-medium">
                  {reservation.rangeStart} → {reservation.rangeEnd}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Warehouse</dt>
                <dd className="mt-1 font-medium">{reservation.warehouseName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reserved at</dt>
                <dd className="mt-1">{formatDateTimeMedium(reservation.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Purchase request</dt>
                <dd className="mt-1">
                  <Link
                    href={`/purchase-requests/${prId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {formatProcurementRef(prId)}
                  </Link>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {!labelsLoading ? (
          <PageAlert variant="info">
            Store managers cannot export or copy serial data from this screen. Each page prints one
            barcode with KNOT branding to prevent duplicate usage. Page setup is chosen when you
            confirm the reservation.
          </PageAlert>
        ) : null}

        <Link
          href="/purchase-requests"
          className={cn(
            buttonVariants({ variant: labelsLoading ? "outline" : "default" }),
            labelsLoading && "pointer-events-none opacity-50",
          )}
          aria-disabled={labelsLoading}
          tabIndex={labelsLoading ? -1 : undefined}
        >
          Done — back to purchase requests
        </Link>
      </div>

      {autoPrint && mountPrintSheet ? (
        <SerialBarcodePrintSheet
          reservationId={reservation.id}
          rangeStart={reservation.rangeStart}
          rangeEnd={reservation.rangeEnd}
          seriesName={seriesName}
          labelConfig={labelConfig}
          autoPrint={autoPrint}
          onStatusChange={setPrintStatus}
          onProgress={(completed, total) => setLabelProgress({ completed, total })}
        />
      ) : null}
    </>
  );
}
