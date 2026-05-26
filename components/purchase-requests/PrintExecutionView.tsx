"use client";

import { SerialSeries } from "@prisma/client";
import Link from "next/link";
import * as React from "react";

import { generateSerialCSV, generateSerialLabelTxt } from "@/app/actions/serial";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatProcurementRef, formatSerialBatchLabel } from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { getSeriesDisplayName } from "@/lib/serial-series";
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileDown,
  Tags,
} from "lucide-react";

export function PrintExecutionView({
  prId,
  reservation,
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
}) {
  const [pending, startTransition] = React.useTransition();
  const [copyLabel, setCopyLabel] = React.useState("Copy range to clipboard");
  const seriesName = getSeriesDisplayName(reservation.series as SerialSeries);
  const rangeText = `${reservation.rangeStart} → ${reservation.rangeEnd}`;
  const clipboardText = `Start: ${reservation.rangeStart} | End: ${reservation.rangeEnd} | Qty: ${reservation.quantity}`;

  function downloadCsv() {
    startTransition(async () => {
      const csv = await generateSerialCSV(reservation.id);
      if (!csv) {
        return;
      }
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prId}-serials.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function downloadPdf() {
    startTransition(async () => {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const margin = 14;
      let y = 20;
      doc.setFontSize(14);
      doc.text("KNOT Procurement — Serial numbers", margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.text(
        `PR: ${formatProcurementRef(prId)} · ${formatSerialBatchLabel({
          seriesName,
          rangeStart: reservation.rangeStart,
          rangeEnd: reservation.rangeEnd,
          quantity: reservation.quantity,
        })}`,
        margin,
        y,
      );
      y += 6;
      doc.text(`Series: ${seriesName} · ${reservation.quantity} labels`, margin, y);
      y += 10;

      const start = BigInt(reservation.rangeStart);
      const end = BigInt(reservation.rangeEnd);
      for (let n = start; n <= end; n++) {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(n.toString(), margin, y);
        y += 5;
      }
      doc.save(`${prId}-serials.pdf`);
    });
  }

  function downloadLabelFormat() {
    startTransition(async () => {
      const txt = await generateSerialLabelTxt(reservation.id);
      if (!txt) {
        return;
      }
      const blob = new Blob([txt], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prId}-labels.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  async function copyRange() {
    await navigator.clipboard.writeText(clipboardText);
    setCopyLabel("Copied!");
    window.setTimeout(() => setCopyLabel("Copy range to clipboard"), 1500);
  }

  const exportButtons = [
    { label: "Download CSV", icon: Download, onClick: downloadCsv },
    { label: "Download PDF", icon: FileDown, onClick: downloadPdf },
    { label: "Download Label Format", icon: Tags, onClick: downloadLabelFormat },
    { label: copyLabel, icon: ClipboardCopy, onClick: copyRange },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-status-success/30 bg-[var(--status-success-bg)] px-4 py-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-status-success" strokeWidth={1.5} />
          <div>
            <p className="text-ds-md font-semibold text-foreground">
              Serial range reserved successfully
            </p>
            <p className="mt-0.5 text-ds-sm text-muted-foreground">
              {formatSerialBatchLabel({
                seriesName,
                rangeStart: reservation.rangeStart,
                rangeEnd: reservation.rangeEnd,
                quantity: reservation.quantity,
              })}{" "}
              is ready for export.
            </p>
          </div>
        </div>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Reservation details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-ds-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Series</dt>
              <dd>{seriesName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Batch</dt>
              <dd className="text-ds-sm">
                {formatSerialBatchLabel({
                  seriesName,
                  rangeStart: reservation.rangeStart,
                  rangeEnd: reservation.rangeEnd,
                  quantity: reservation.quantity,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Range</dt>
              <dd className="font-mono">{rangeText}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quantity</dt>
              <dd>{reservation.quantity}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Warehouse</dt>
              <dd>{reservation.warehouseName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reserved by</dt>
              <dd>{reservation.createdByName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reserved at</dt>
              <dd>{formatDateTimeMedium(reservation.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Linked PR</dt>
              <dd>
                <Link href={`/purchase-requests/${prId}`} className="text-primary hover:underline">
                  {prId}
                </Link>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {exportButtons.map((btn) => {
          const Icon = btn.icon;
          return (
            <Button
              key={btn.label}
              type="button"
              variant="outline"
              className="h-9 gap-2"
              disabled={pending}
              onClick={btn.onClick}
            >
              <Icon className="size-3.5" strokeWidth={1.5} />
              {btn.label}
            </Button>
          );
        })}
      </div>

      <Link href="/purchase-requests" className={cn(buttonVariants())}>
        Done — Back to Purchase Requests
      </Link>
    </div>
  );
}
