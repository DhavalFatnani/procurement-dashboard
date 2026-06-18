"use client";

import type { SeriesCode } from "@/lib/series-codes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LabelPreviewCompact } from "@/components/label-studio/LabelPreviewCompact";
import { ReserveSerialBatchPanel } from "@/components/purchase-requests/ReserveSerialBatchPanel";
import type { LabelTemplate, ResolvedLabelTemplate } from "@/lib/label-template-types";
import { formatSerialBatchLabel } from "@/lib/display-ref";
import { getSeriesPrefix } from "@/lib/serial-series";
import { cn } from "@/lib/utils";
import { Info, Loader2, Printer, ShieldCheck } from "lucide-react";

export type ReserveSerialRangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: SeriesCode;
  seriesName: string;
  categoryName?: string;
  quantity: number;
  rangeStart: string;
  rangeEnd: string;
  warehouseLabel: string;
  waitMessage?: string | null;
  reserving?: boolean;
  labelTemplate: LabelTemplate;
  labelCustomized?: boolean;
  onLabelReset?: () => void;
  resolved?: ResolvedLabelTemplate;
  returnTo: string;
  onConfirm: () => void;
};

export function ReserveSerialRangeDialog({
  open,
  onOpenChange,
  series,
  seriesName,
  categoryName,
  quantity,
  rangeStart,
  rangeEnd,
  warehouseLabel,
  waitMessage,
  reserving = false,
  labelTemplate,
  labelCustomized = false,
  onLabelReset,
  resolved,
  returnTo,
  onConfirm,
}: ReserveSerialRangeDialogProps) {
  const batchLabel = formatSerialBatchLabel({
    seriesName,
    rangeStart,
    rangeEnd,
    quantity,
  });
  const seriesPrefix = getSeriesPrefix(series);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !reserving && onOpenChange(next)}>
      <AlertDialogContent
        size="wide"
        className="flex max-h-[min(90vh,720px)] min-h-0 min-w-0 flex-col gap-0 overflow-hidden p-0"
      >
        <header className="shrink-0 border-b border-border-subtle bg-gradient-to-br from-card via-card to-muted/30 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl surface-accent-soft shadow-ds">
              <ShieldCheck className="size-5" strokeWidth={1.5} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <AlertDialogTitle className="text-left text-ds-lg font-semibold tracking-tight">
                Confirm &amp; reserve
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left text-ds-sm leading-relaxed">
                Review your serial batch and label layout, then reserve and print.
              </AlertDialogDescription>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 lg:flex-row lg:gap-6">
          <div className="min-w-0 flex-1 lg:max-w-md">
            <ReserveSerialBatchPanel
              batchLabel={batchLabel}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              quantity={quantity}
              seriesPrefix={seriesPrefix}
              seriesName={seriesName}
              categoryName={categoryName}
              warehouseLabel={warehouseLabel}
            />
          </div>

          <div className="min-w-0 flex-1 lg:max-w-sm">
            <LabelPreviewCompact
              template={labelTemplate}
              resolved={resolved}
              customized={labelCustomized}
              series={series}
              seriesName={seriesName}
              sampleSerial={rangeStart}
              returnTo={returnTo}
              onReset={onLabelReset}
            />
          </div>
        </div>

        <footer className="shrink-0 border-t border-border-subtle bg-card px-5 py-4 sm:px-6">
          {waitMessage ? (
            <p className="mb-3 flex items-center gap-2 text-ds-sm text-muted-foreground">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              {waitMessage}
            </p>
          ) : null}

          <div className="mb-3 flex items-start gap-2 rounded-lg border border-border-subtle bg-muted/20 px-3 py-2.5">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
            <p className="text-ds-xs leading-relaxed text-muted-foreground">
              Reserving locks this serial range to your warehouse. Customize your label in Label
              Studio before confirming, or use the default layout.
            </p>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={reserving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reserving}
              className={cn(reserving && "pointer-events-none")}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {reserving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Reserving…
                </>
              ) : (
                <>
                  <Printer className="size-4" aria-hidden />
                  Reserve &amp; print
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </footer>
      </AlertDialogContent>
    </AlertDialog>
  );
}
