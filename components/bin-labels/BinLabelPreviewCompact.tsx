"use client";

import Link from "next/link";

import { LabelCanvas } from "@/components/label-designer/LabelCanvas";
import type { LabelBindingContext, LabelTemplate, ResolvedLabelTemplate } from "@/lib/label-template-types";
import { buildLabelStudioUrl } from "@/lib/label-studio-url";
import { resolvedSourceLabel } from "@/lib/label-studio-wizard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Palette } from "lucide-react";

export function BinLabelPreviewCompact({
  template,
  resolved,
  context,
  className,
}: {
  template: LabelTemplate;
  resolved?: ResolvedLabelTemplate;
  context: LabelBindingContext;
  className?: string;
}) {
  const studioUrl = buildLabelStudioUrl({ view: "library", purpose: "bin" });

  return (
    <section
      className={cn(
        "rounded-xl border border-border-subtle bg-gradient-to-br from-card to-muted/20 p-4",
        className,
      )}
      aria-labelledby="bin-label-preview-heading"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 id="bin-label-preview-heading" className="text-ds-sm font-semibold text-foreground">
            Label preview
          </h3>
          <p className="mt-0.5 text-ds-xs text-muted-foreground">
            {resolved ? resolvedSourceLabel(resolved.source) : "Bin layout"}
            {context.binCode ? (
              <>
                {" "}
                · sample <span className="font-mono tabular-nums">{context.binCode}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mb-4 flex justify-center rounded-lg border border-border-subtle bg-zinc-100/60 py-3">
        <LabelCanvas template={template} context={context} compact />
      </div>

      <Link
        href={studioUrl}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-2")}
      >
        <Palette className="size-4" aria-hidden />
        Customize label
      </Link>
    </section>
  );
}
