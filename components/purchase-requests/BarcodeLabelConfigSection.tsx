"use client";

import type { SeriesCode } from "@/lib/series-codes";

import { BarcodeLabelSetupPanel } from "@/components/purchase-requests/BarcodeLabelSetupPanel";
import type { LabelTemplate, ResolvedLabelTemplate } from "@/lib/label-template-types";
import { cn } from "@/lib/utils";

export function BarcodeLabelConfigSection({
  template,
  onChange,
  disabled = false,
  layoutLocked = false,
  onLockLayout,
  onUnlockLayout,
  series,
  seriesName,
  sampleSerial,
  reservationId,
  prId,
  resolved,
  isAdmin,
  canManageSeries,
  className,
  embedded = false,
}: {
  template: LabelTemplate;
  onChange: (template: LabelTemplate) => void;
  disabled?: boolean;
  layoutLocked?: boolean;
  onLockLayout?: () => void;
  onUnlockLayout?: () => void;
  series?: SeriesCode;
  seriesName?: string;
  sampleSerial?: string;
  reservationId?: string;
  prId?: string;
  resolved?: ResolvedLabelTemplate;
  isAdmin?: boolean;
  canManageSeries?: boolean;
  className?: string;
  embedded?: boolean;
}) {
  return (
    <BarcodeLabelSetupPanel
      template={template}
      onChange={onChange}
      disabled={disabled}
      layoutLocked={layoutLocked}
      onLockLayout={onLockLayout}
      onUnlockLayout={onUnlockLayout}
      series={series}
      seriesName={seriesName}
      sampleSerial={sampleSerial}
      reservationId={reservationId}
      prId={prId}
      resolved={resolved}
      isAdmin={isAdmin}
      canManageSeries={canManageSeries}
      className={cn(embedded ? "min-h-0" : "rounded-xl border border-border-subtle bg-card p-4", className)}
    />
  );
}
