"use client";

import * as React from "react";

import type { SeriesCode } from "@/lib/series-codes";
import type { LabelBindingContext, LabelTemplate, ResolvedLabelTemplate } from "@/lib/label-template-types";
import { normalizeLabelTemplate } from "@/lib/label-template-types";
import { BUILT_IN_LABEL_PRESETS, getReferencePreset } from "@/lib/label-template-presets";
import { ElementInspector, type ElementSelection } from "@/components/label-designer/ElementInspector";
import { FreeformToolbar } from "@/components/label-designer/FreeformToolbar";
import { GridToolbar } from "@/components/label-designer/GridToolbar";
import { LabelCanvas } from "@/components/label-designer/LabelCanvas";
import { TemplateSaveBar } from "@/components/label-designer/TemplateSaveBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Lock, LockOpen, RotateCcw } from "lucide-react";

export type LabelDesignerProps = {
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
};

export function LabelDesigner({
  template: incomingTemplate,
  onChange,
  disabled = false,
  layoutLocked = false,
  onLockLayout,
  onUnlockLayout,
  seriesName = "Series name",
  sampleSerial = "2000000000",
  reservationId,
  prId,
  resolved,
  isAdmin = false,
  canManageSeries = false,
  className,
}: LabelDesignerProps) {
  const [template, setTemplate] = React.useState(() => normalizeLabelTemplate(incomingTemplate));
  const [selectedCellId, setSelectedCellId] = React.useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTemplate(normalizeLabelTemplate(incomingTemplate));
  }, [incomingTemplate]);

  const readOnly = disabled || layoutLocked;
  const context: LabelBindingContext = {
    serial: sampleSerial,
    seriesName,
    prId,
    prNumber: prId,
    reservationId,
  };

  const updateTemplate = (next: LabelTemplate) => {
    const normalized = normalizeLabelTemplate(next);
    setTemplate(normalized);
    onChange(normalized);
  };

  const selection: ElementSelection | null =
    selectedCellId && template.cells
      ? (() => {
          const cell = template.cells!.find((c) => c.id === selectedCellId);
          return cell ? { mode: "grid" as const, cell } : null;
        })()
      : selectedElementId && template.elements
        ? (() => {
            const element = template.elements!.find((e) => e.id === selectedElementId);
            return element ? { mode: "freeform" as const, element } : null;
          })()
        : null;

  const applyPreset = (presetId: string) => {
    const preset = BUILT_IN_LABEL_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      updateTemplate(structuredClone(preset.template));
    }
  };

  const resetToReference = () => {
    updateTemplate(getReferencePreset());
  };

  const toggleLayoutMode = (mode: "grid" | "freeform") => {
    if (mode === template.layoutMode) return;
    if (mode === "freeform") {
      updateTemplate({
        ...template,
        layoutMode: "freeform",
        elements: template.elements ?? [],
      });
    } else {
      const ref = getReferencePreset();
      updateTemplate({
        ...template,
        layoutMode: "grid",
        grid: ref.grid,
        cells: ref.cells,
      });
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-ds-md font-semibold text-foreground">Label designer</h3>
          <p className="mt-0.5 text-ds-sm text-muted-foreground">
            Grid builder with optional free-form mode. Click cells to edit bindings and styles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {layoutLocked ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={onUnlockLayout}
            >
              <LockOpen className="size-3.5" aria-hidden />
              Unlock
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={onLockLayout}
            >
              <Lock className="size-3.5" aria-hidden />
              Lock layout
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={readOnly}
            onClick={resetToReference}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </Button>
        </div>
      </div>

      <TemplateSaveBar
        template={template}
        reservationId={reservationId}
        resolved={resolved}
        isAdmin={isAdmin}
        canManageSeries={canManageSeries}
        disabled={readOnly}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,18rem)]">
        <LabelCanvas
          template={template}
          context={context}
          selectedCellId={selectedCellId}
          selectedElementId={selectedElementId}
          onSelectCell={setSelectedCellId}
          onSelectElement={setSelectedElementId}
        />

        <aside className="space-y-4 rounded-lg border border-border-subtle bg-muted/10 p-3">
          <div className="space-y-2">
            <Label className="text-ds-xs">Layout mode</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={template.layoutMode === "grid" ? "default" : "outline"}
                disabled={readOnly}
                onClick={() => toggleLayoutMode("grid")}
              >
                Grid
              </Button>
              <Button
                type="button"
                size="sm"
                variant={template.layoutMode === "freeform" ? "default" : "outline"}
                disabled={readOnly}
                onClick={() => toggleLayoutMode("freeform")}
              >
                Free-form
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-ds-xs">Preset</Label>
            <Select disabled={readOnly} onValueChange={applyPreset}>
              <SelectTrigger>
                <SelectValue placeholder="Load preset…" />
              </SelectTrigger>
              <SelectContent>
                {BUILT_IN_LABEL_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-ds-2xs">W (mm)</Label>
              <Input
                type="number"
                min={20}
                max={300}
                value={template.page.widthMm}
                disabled={readOnly}
                onChange={(e) =>
                  updateTemplate({
                    ...template,
                    page: { ...template.page, widthMm: Number.parseFloat(e.target.value) || 58 },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-ds-2xs">H (mm)</Label>
              <Input
                type="number"
                min={15}
                max={300}
                value={template.page.heightMm}
                disabled={readOnly}
                onChange={(e) =>
                  updateTemplate({
                    ...template,
                    page: { ...template.page, heightMm: Number.parseFloat(e.target.value) || 40 },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-ds-2xs">Margin</Label>
              <Input
                type="number"
                min={0}
                max={15}
                value={template.page.marginMm}
                disabled={readOnly}
                onChange={(e) =>
                  updateTemplate({
                    ...template,
                    page: { ...template.page, marginMm: Number.parseFloat(e.target.value) || 0 },
                  })
                }
              />
            </div>
          </div>

          {template.layoutMode === "grid" ? (
            <GridToolbar template={template} onChange={updateTemplate} disabled={readOnly} />
          ) : (
            <FreeformToolbar
              template={template}
              selectedId={selectedElementId}
              onChange={updateTemplate}
              onSelect={setSelectedElementId}
              disabled={readOnly}
            />
          )}

          <div className="border-t border-border-subtle pt-3">
            <h4 className="mb-2 text-ds-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Inspector
            </h4>
            <ElementInspector
              template={template}
              selection={selection}
              onChange={updateTemplate}
              disabled={readOnly}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
