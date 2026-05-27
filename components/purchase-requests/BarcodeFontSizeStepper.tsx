"use client";

import { Button } from "@/components/ui/button";
import {
  BARCODE_TYPOGRAPHY_SCALE_MAX,
  BARCODE_TYPOGRAPHY_SCALE_MIN,
  BARCODE_TYPOGRAPHY_SCALE_STEP,
  formatTypographyScalePercent,
} from "@/lib/barcode-label-config";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

function clampScale(value: number, min: number, max: number, step: number): number {
  const stepped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, stepped));
}

export function BarcodeFontSizeStepper({
  value,
  disabled,
  onChange,
  className,
  affectedLabel,
  fontPt,
  scaleMin = BARCODE_TYPOGRAPHY_SCALE_MIN,
  scaleMax = BARCODE_TYPOGRAPHY_SCALE_MAX,
  scaleStep = BARCODE_TYPOGRAPHY_SCALE_STEP,
}: {
  value: number;
  disabled?: boolean;
  onChange: (scale: number) => void;
  className?: string;
  affectedLabel?: string;
  /** Resolved print size in pt shown beside the percentage. */
  fontPt?: number;
  scaleMin?: number;
  scaleMax?: number;
  scaleStep?: number;
}) {
  const atMin = value <= scaleMin;
  const atMax = value >= scaleMax;
  const ariaDescription = affectedLabel
    ? `${affectedLabel}. Current size ${formatTypographyScalePercent(value)}${fontPt !== undefined ? `, ${fontPt} pt when printed` : ""}.`
    : undefined;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled || atMin}
        aria-label={affectedLabel ? `Decrease ${affectedLabel}` : "Decrease text size"}
        onClick={() => onChange(clampScale(value - scaleStep, scaleMin, scaleMax, scaleStep))}
      >
        <Minus className="size-3.5" strokeWidth={1.5} />
      </Button>
      <div className="flex min-w-[4.5rem] flex-col items-center">
        <span
          className="font-mono text-ds-sm font-medium tabular-nums text-foreground"
          aria-live="polite"
          aria-label={ariaDescription}
        >
          {formatTypographyScalePercent(value)}
        </span>
        {fontPt !== undefined ? (
          <span className="font-mono text-ds-2xs tabular-nums text-muted-foreground">{fontPt} pt</span>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={disabled || atMax}
        aria-label={affectedLabel ? `Increase ${affectedLabel}` : "Increase text size"}
        onClick={() => onChange(clampScale(value + scaleStep, scaleMin, scaleMax, scaleStep))}
      >
        <Plus className="size-3.5" strokeWidth={1.5} />
      </Button>
    </div>
  );
}
