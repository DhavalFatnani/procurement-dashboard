"use client";

import Link from "next/link";

import { LabelCanvas } from "@/components/label-designer/LabelCanvas";
import type { SeriesCode } from "@/lib/series-codes";
import type { LabelTemplate, ResolvedLabelTemplate } from "@/lib/label-template-types";
import { buildLabelStudioUrl } from "@/lib/label-studio-url";
import { resolvedSourceLabel } from "@/lib/label-studio-wizard";
import { getReferencePreset } from "@/lib/label-template-presets";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Palette, RotateCcw } from "lucide-react";

export function LabelPreviewCompact({
  template,
  resolved,
  customized = false,
  series,
  seriesName,
  sampleSerial,
  returnTo,
  onReset,
  className,
}: {
  template: LabelTemplate;
  resolved?: ResolvedLabelTemplate;
  customized?: boolean;
  series: SeriesCode;
  seriesName: string;
  sampleSerial: string;
  returnTo: string;
  onReset?: () => void;
  className?: string;
}) {
  const studioUrl = buildLabelStudioUrl({
    view: "editor",
    purpose: "serial",
    series,
    returnTo,
    mode: "wizard",
  });

  const sourceLabel = resolved
    ? resolvedSourceLabel(resolved.source)
    : customized
      ? "Your layout"
      : "Default";

  return (
    <section
      className={cn(
        "rounded-xl border border-border-subtle bg-gradient-to-br from-card to-muted/20 p-4",
        className,
      )}
      aria-labelledby="label-preview-heading"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 id="label-preview-heading" className="text-ds-sm font-semibold text-foreground">
            Label layout
          </h3>
          <p className="mt-0.5 text-ds-xs text-muted-foreground">
            {customized ? "Customized for this print" : "Using saved layout"} · {sourceLabel}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-ds-2xs font-medium",
            customized
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {customized ? "Ready" : "Default"}
        </span>
      </div>

      <div className="mb-2 flex justify-center rounded-lg border border-border-subtle bg-zinc-100/60 py-3">
        <LabelCanvas
          template={template}
          context={{ serial: sampleSerial, seriesName }}
          compact
        />
      </div>
      <p className="mb-4 text-center text-ds-2xs text-muted-foreground">
        Preview uses serial <span className="font-mono tabular-nums text-foreground">{sampleSerial}</span>
      </p>

      <div className="flex flex-wrap gap-2">
        <Link
          href={studioUrl}
          className={cn(buttonVariants({ className: "flex-1 sm:flex-none inline-flex items-center gap-2" }))}
        >
          <Palette className="size-4" aria-hidden />
          Customize label
        </Link>
        {onReset ? (
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" aria-hidden />
            Reset to default
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function resetTemplateToDefault(): LabelTemplate {
  return getReferencePreset();
}
