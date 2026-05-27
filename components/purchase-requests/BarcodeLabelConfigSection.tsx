"use client";

import { SerialSeries } from "@prisma/client";

import { BarcodeLabelSetupPanel } from "@/components/purchase-requests/BarcodeLabelSetupPanel";
import type { BarcodeLabelConfig } from "@/lib/barcode-label-config";
import { cn } from "@/lib/utils";

/** @deprecated Use BarcodeLabelSetupPanel directly. Thin wrapper for existing imports. */
export function BarcodeLabelConfigSection({
  config,
  onChange,
  disabled = false,
  layoutLocked = false,
  onLockLayout,
  onUnlockLayout,
  series,
  seriesName,
  sampleSerial,
  className,
  embedded = false,
  showPreview: _showPreview = true,
}: {
  config: BarcodeLabelConfig;
  onChange: (config: BarcodeLabelConfig) => void;
  disabled?: boolean;
  layoutLocked?: boolean;
  onLockLayout?: () => void;
  onUnlockLayout?: () => void;
  series?: SerialSeries;
  seriesName?: string;
  sampleSerial?: string;
  className?: string;
  embedded?: boolean;
  showPreview?: boolean;
}) {
  return (
    <BarcodeLabelSetupPanel
      config={config}
      onChange={onChange}
      disabled={disabled}
      layoutLocked={layoutLocked}
      onLockLayout={onLockLayout}
      onUnlockLayout={onUnlockLayout}
      series={series}
      seriesName={seriesName}
      sampleSerial={sampleSerial}
      className={cn(embedded ? "min-h-0" : "rounded-xl border border-border-subtle bg-card p-4", className)}
    />
  );
}
