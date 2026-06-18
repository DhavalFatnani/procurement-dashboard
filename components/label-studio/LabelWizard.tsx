"use client";

import * as React from "react";

import { LabelPresetGallery } from "@/components/label-studio/LabelPresetGallery";
import { LabelElementList } from "@/components/label-studio/LabelElementList";
import { LabelSizePicker } from "@/components/label-studio/LabelSizePicker";
import { LabelStudioCanvas } from "@/components/label-studio/LabelStudioCanvas";
import { LabelInspectorPanel } from "@/components/label-studio/LabelInspectorPanel";
import type { ElementSelection } from "@/components/label-designer/ElementInspector";
import type { LabelBindingContext, LabelTemplate, LabelTemplatePurpose } from "@/lib/label-template-types";
import { getBuiltInPresetsForPurpose } from "@/lib/label-template-presets";
import { addGridCell, removeGridCell } from "@/lib/label-studio-utils";
import { WIZARD_STEP_TITLES, validateWizardStep } from "@/lib/label-studio-wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

export function LabelWizard({
  step,
  template,
  onChange,
  onStepChange,
  context,
  purpose = "serial",
  disabled,
  onSwitchToStudio,
}: {
  step: number;
  template: LabelTemplate;
  onChange: (template: LabelTemplate) => void;
  onStepChange: (step: number) => void;
  context: LabelBindingContext;
  purpose?: LabelTemplatePurpose;
  disabled?: boolean;
  onSwitchToStudio?: () => void;
}) {
  const [selectedCellId, setSelectedCellId] = React.useState<string | null>(null);
  const validation = validateWizardStep(step, template);

  const selection: ElementSelection | null =
    selectedCellId && template.cells
      ? (() => {
          const cell = template.cells!.find((c) => c.id === selectedCellId);
          return cell ? { mode: "grid" as const, cell } : null;
        })()
      : null;

  function applyPreset(presetId: string) {
    const preset = getBuiltInPresetsForPurpose(purpose).find((p) => p.id === presetId);
    if (preset) onChange(structuredClone(preset.template));
  }

  function removeSelectedCell() {
    if (!selectedCellId) return;
    onChange(removeGridCell(template, selectedCellId));
    setSelectedCellId(null);
  }

  React.useEffect(() => {
    if (disabled || (step !== 3 && step !== 4) || selectedCellId == null) return;
    const cellId = selectedCellId;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (document.activeElement?.tagName === "INPUT") return;
      e.preventDefault();
      onChange(removeGridCell(template, cellId));
      setSelectedCellId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, step, selectedCellId, template, onChange]);

  const stepContent = (() => {
    switch (step) {
      case 1:
        return (
          <div className="w-full space-y-4">
            <p className="text-ds-sm text-muted-foreground">
              Pick a starting layout. You can customize everything in later steps.
            </p>
            <LabelPresetGallery
              onSelect={applyPreset}
              context={context}
              purpose={purpose}
              disabled={disabled}
              className="sm:grid-cols-2 lg:grid-cols-3"
            />
            {onSwitchToStudio ? (
              <button
                type="button"
                className="text-ds-sm text-primary underline-offset-4 hover:underline"
                onClick={onSwitchToStudio}
              >
                Skip to advanced studio
              </button>
            ) : null}
          </div>
        );
      case 2:
        return (
          <div className="max-w-xl space-y-6">
            <LabelSizePicker template={template} onChange={onChange} disabled={disabled} />
            <div>
              <Label className="mb-2 block">Margin (mm)</Label>
              <Input
                type="number"
                min={0}
                max={15}
                step={0.5}
                value={template.page.marginMm}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...template,
                    page: {
                      ...template.page,
                      marginMm: Number.parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="max-w-md space-y-4">
            <div>
              <Label className="mb-2 block text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
                Add elements
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChange(addGridCell(template, "text", undefined, purpose))}
                >
                  Add text
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChange(addGridCell(template, "barcode1d", undefined, purpose))}
                >
                  Add barcode
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChange(addGridCell(template, "qrcode", undefined, purpose))}
                >
                  Add QR code
                </Button>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
                  On this label
                </Label>
                {selectedCellId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-destructive hover:text-destructive"
                    disabled={disabled}
                    onClick={removeSelectedCell}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove selected
                  </Button>
                ) : null}
              </div>
              <LabelElementList
                template={template}
                selectedCellId={selectedCellId}
                onSelectCell={setSelectedCellId}
                onChange={onChange}
                disabled={disabled}
              />
            </div>
            <p className="text-ds-xs text-muted-foreground">
              Click an element on the canvas to select it, or use the trash icon to remove it.
              Press Delete to remove the selected element.
            </p>
          </div>
        );
      case 4:
        return (
          <div className="max-w-sm space-y-4">
            <p className="text-ds-sm text-muted-foreground">
              Select an element on the canvas, then set its data binding and styling.
            </p>
            {selectedCellId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={disabled}
                onClick={removeSelectedCell}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remove selected element
              </Button>
            ) : null}
            <LabelElementList
              template={template}
              selectedCellId={selectedCellId}
              onSelectCell={setSelectedCellId}
              onChange={onChange}
              disabled={disabled}
            />
        <LabelInspectorPanel
              template={template}
              selection={selection}
              onChange={onChange}
              disabled={disabled}
              purpose={purpose}
              onRemoveSelection={() => setSelectedCellId(null)}
            />
          </div>
        );
      case 5:
        return (
          <div className="max-w-md space-y-3 text-ds-sm">
            <p className="text-muted-foreground">
              Your label is ready. Use Save in the header to persist as org, series, or personal
              default. Press Done to return to your workflow.
            </p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>
                {(template.cells?.length ?? 0) + (template.elements?.length ?? 0)} elements
              </li>
              <li>
                {template.page.widthMm} × {template.page.heightMm} mm
              </li>
              <li>{template.layoutMode === "grid" ? "Grid layout" : "Free-form layout"}</li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label="Wizard progress" className="mb-6 border-b border-border-subtle pb-4">
        <ol className="flex flex-wrap gap-2">
          {WIZARD_STEP_TITLES.map((title, index) => {
            const stepNum = index + 1;
            const active = step === stepNum;
            const done = step > stepNum;
            return (
              <li key={title}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onStepChange(stepNum)}
                  className={cn(
                    "rounded-full px-3 py-1 text-ds-xs font-medium transition-colors",
                    active && "bg-primary text-primary-foreground",
                    done && !active && "bg-muted text-foreground",
                    !active && !done && "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {stepNum}. {title}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-6",
          step === 1 ? "" : "lg:flex-row",
        )}
      >
        <div className={cn("min-w-0 flex-1", step === 1 ? "w-full" : "lg:max-w-sm")}>
          {stepContent}
        </div>
        {step === 1 ? (
          <div className="relative min-h-[200px] min-w-0 lg:min-h-[280px] lg:max-w-md lg:self-center">
            <p className="mb-2 text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <LabelStudioCanvas
              template={template}
              context={context}
              showZoom={false}
              interactive={false}
            />
          </div>
        ) : (
          <div className="relative min-h-[280px] min-w-0 flex-[1.4]">
            <LabelStudioCanvas
              template={template}
              context={context}
              selectedCellId={selectedCellId}
              onSelectCell={setSelectedCellId}
              onUpdateTemplate={step === 3 && !disabled ? onChange : undefined}
              interactive={step >= 3}
              emptyOverlay={
                step === 3 && (template.cells?.length ?? 0) === 0 ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
                    <p className="rounded-lg bg-background/90 px-4 py-2 text-center text-ds-sm text-muted-foreground shadow-ds">
                      Click Add buttons to place content, then select cells on the canvas
                    </p>
                  </div>
                ) : null
              }
            />
          </div>
        )}
      </div>

      <footer className="mt-6 flex shrink-0 items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || step <= 1}
          onClick={() => onStepChange(step - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back
        </Button>
        {!validation.valid && validation.message ? (
          <p className="text-ds-xs text-destructive" role="alert">
            {validation.message}
          </p>
        ) : (
          <span className="flex-1" />
        )}
        <Button
          type="button"
          disabled={disabled || (step < 5 && !validation.valid)}
          onClick={() => (step < 5 ? onStepChange(step + 1) : undefined)}
        >
          {step < 5 ? (
            <>
              Continue
              <ChevronRight className="size-4" aria-hidden />
            </>
          ) : (
            "Finish"
          )}
        </Button>
      </footer>
    </div>
  );
}
