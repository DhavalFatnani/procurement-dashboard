"use client";

import * as React from "react";

import { LabelCanvas } from "@/components/label-designer/LabelCanvas";
import type { LabelBindingContext, LabelTemplatePurpose } from "@/lib/label-template-types";
import { getBuiltInPresetsForPurpose } from "@/lib/label-template-presets";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function LabelPresetGallery({
  selectedPresetId,
  onSelect,
  context,
  purpose = "serial",
  disabled,
  className,
}: {
  selectedPresetId?: string | null;
  onSelect: (presetId: string) => void;
  context: LabelBindingContext;
  purpose?: LabelTemplatePurpose;
  disabled?: boolean;
  className?: string;
}) {
  const presets = getBuiltInPresetsForPurpose(purpose);
  const [activeId, setActiveId] = React.useState<string | null>(
    selectedPresetId ?? presets[0]?.id ?? null,
  );

  React.useEffect(() => {
    if (selectedPresetId) {
      setActiveId(selectedPresetId);
    }
  }, [selectedPresetId]);

  return (
    <div
      className={cn(
        "grid max-h-[min(52vh,480px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2",
        className,
      )}
      role="listbox"
      aria-label="Starting layouts"
    >
      {presets.map((preset) => {
        const selected = activeId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => {
              setActiveId(preset.id);
              onSelect(preset.id);
            }}
            className={cn(
              "group relative flex flex-col items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
              selected
                ? "border-primary bg-[var(--accent-subtle)] ring-1 ring-primary/30"
                : "border-border-subtle bg-card hover:border-border-default hover:bg-muted/20",
            )}
          >
            {selected ? (
              <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3.5" aria-hidden />
              </span>
            ) : null}
            <div className="flex w-full justify-center rounded-md bg-zinc-100/80 py-2">
              <LabelCanvas template={preset.template} context={context} compact />
            </div>
            <div className="min-w-0 pr-6">
              <p className="text-ds-sm font-medium text-foreground">{preset.name}</p>
              <p className="mt-0.5 line-clamp-2 text-ds-xs leading-snug text-muted-foreground">
                {preset.description}
              </p>
              <p className="mt-1 text-ds-2xs text-muted-foreground/80">
                {preset.template.page.widthMm} × {preset.template.page.heightMm} mm
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
