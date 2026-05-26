"use client";

import { SerialSeries } from "@prisma/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarcodeLabelConfigSection } from "@/components/purchase-requests/BarcodeLabelConfigSection";
import { ReserveSerialBatchPanel } from "@/components/purchase-requests/ReserveSerialBatchPanel";
import type { BarcodeLabelConfig } from "@/lib/barcode-label-config";
import { formatSerialBatchLabel } from "@/lib/display-ref";
import { getSeriesPrefix } from "@/lib/serial-series";
import { cn } from "@/lib/utils";
import { Info, Loader2, Printer, ShieldCheck } from "lucide-react";

export type ReserveSerialRangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: SerialSeries;
  seriesName: string;
  categoryName?: string;
  quantity: number;
  rangeStart: string;
  rangeEnd: string;
  warehouseLabel: string;
  waitMessage?: string | null;
  reserving?: boolean;
  labelConfig: BarcodeLabelConfig;
  onLabelConfigChange: (config: BarcodeLabelConfig) => void;
  layoutLocked?: boolean;
  onLockLayout?: () => void;
  onUnlockLayout?: () => void;
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
  labelConfig,
  onLabelConfigChange,
  layoutLocked = false,
  onLockLayout,
  onUnlockLayout,
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
        className="flex max-h-[min(94vh,920px)] min-w-0 flex-col gap-0 overflow-hidden p-0"
      >
        {/* Header */}
        <header className="shrink-0 border-b border-border-subtle bg-gradient-to-br from-card via-card to-muted/30 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-ds">
              <ShieldCheck className="size-5" strokeWidth={1.5} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <AlertDialogTitle className="text-left text-ds-lg font-semibold tracking-tight">
                Confirm &amp; reserve
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left text-ds-sm leading-relaxed">
                Lock a contiguous serial range for your warehouse, then open the print flow with
                your label settings.
              </AlertDialogDescription>
            </div>
          </div>
        </header>

        {/* Body — side-by-side only when the modal is wide enough */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[minmax(300px,22rem)_minmax(0,1fr)] lg:divide-x lg:divide-border-subtle">
            <div className="min-w-0 bg-muted/15 px-6 py-6 lg:px-7">
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

            <div className="min-w-0 border-t border-border-subtle px-6 py-6 lg:border-t-0 lg:px-7">
              <BarcodeLabelConfigSection
                embedded
                config={labelConfig}
                onChange={onLabelConfigChange}
                disabled={reserving}
                layoutLocked={layoutLocked}
                onLockLayout={onLockLayout}
                onUnlockLayout={onUnlockLayout}
                seriesName={seriesName}
                sampleSerial={rangeStart}
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0 border-t border-border-subtle px-5 py-3 sm:px-6">
          {waitMessage ? (
            <div
              className="flex items-center gap-3 rounded-xl border border-status-info/25 bg-[var(--status-info-bg)] px-4 py-3"
              role="status"
            >
              <Loader2
                className="size-4 shrink-0 animate-spin text-status-info"
                strokeWidth={1.5}
              />
              <p className="text-ds-sm font-medium text-foreground">{waitMessage}</p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-muted/40 px-4 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-ds-xs leading-relaxed text-muted-foreground">
                Reservation is atomic — no overlapping ranges. If another store is printing, we
                retry briefly before asking you to try again.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <AlertDialogFooter className="mx-0 mb-0 shrink-0 flex-col gap-2 border-t border-border-subtle bg-card px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
          <p className="hidden text-ds-xs text-muted-foreground sm:block sm:max-w-[240px] sm:self-center">
            {quantity} {quantity === 1 ? "page" : "pages"} will print after reserve.
          </p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <AlertDialogCancel disabled={reserving} className="sm:min-w-[7.5rem]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={reserving}
              className={cn("gap-2 sm:min-w-[11rem]", reserving && "opacity-90")}
              onClick={(event) => {
                event.preventDefault();
                if (reserving) {
                  return;
                }
                onConfirm();
              }}
            >
              {reserving ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
                  Reserving…
                </>
              ) : (
                <>
                  <Printer className="size-4" strokeWidth={1.5} />
                  Reserve &amp; print
                </>
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
