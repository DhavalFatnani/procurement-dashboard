"use client";

import * as React from "react";

import { LabelCanvas } from "@/components/label-designer/LabelCanvas";
import type { LabelTemplate } from "@/lib/label-template-types";
import { cn } from "@/lib/utils";

export function BarcodeLabelPreview({
  template,
  seriesName,
  sampleSerial = "2000000000",
  compact = false,
  sticky = false,
  className,
  prId,
  reservationId,
}: {
  template: LabelTemplate;
  seriesName?: string;
  sampleSerial?: string;
  compact?: boolean;
  sticky?: boolean;
  className?: string;
  prId?: string;
  reservationId?: string;
}) {
  return (
    <LabelCanvas
      template={template}
      context={{
        serial: sampleSerial,
        seriesName: seriesName ?? "Series name",
        prId,
        prNumber: prId,
        reservationId,
      }}
      compact={compact}
      className={cn(
        "rounded-xl border border-border-subtle bg-card p-4",
        sticky && "lg:sticky lg:top-0 lg:z-10 lg:shadow-sm",
        className,
      )}
    />
  );
}
