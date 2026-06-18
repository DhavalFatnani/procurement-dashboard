"use client";

import type { SeriesCode } from "@/lib/series-codes";
import type { LabelTemplate, ResolvedLabelTemplate } from "@/lib/label-template-types";

import { LabelDesigner } from "@/components/label-designer/LabelDesigner";
import { cn } from "@/lib/utils";

export function BarcodeLabelSetupPanel({
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
  isAdmin = false,
  canManageSeries = false,
  className,
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
}) {
  return (
    <LabelDesigner
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
      className={cn(className)}
    />
  );
}
