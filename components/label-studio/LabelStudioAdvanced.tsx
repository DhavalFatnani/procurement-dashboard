"use client";

import * as React from "react";

import { LabelInspectorPanel } from "@/components/label-studio/LabelInspectorPanel";
import { LabelStudioCanvas } from "@/components/label-studio/LabelStudioCanvas";
import type { ElementSelection } from "@/components/label-designer/ElementInspector";
import type { LabelBindingContext, LabelTemplate, LabelTemplatePurpose } from "@/lib/label-template-types";
import { addFreeformElement, addGridCell } from "@/lib/label-studio-utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Layers, Plus, Trash2 } from "lucide-react";

export function LabelStudioAdvanced({
  template,
  onChange,
  context,
  purpose = "serial",
  disabled,
}: {
  template: LabelTemplate;
  onChange: (template: LabelTemplate) => void;
  context: LabelBindingContext;
  purpose?: LabelTemplatePurpose;
  disabled?: boolean;
}) {
  const [selectedCellId, setSelectedCellId] = React.useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);

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

  const layers =
    template.layoutMode === "grid"
      ? (template.cells ?? []).map((cell) => ({
          id: cell.id,
          label: `${cell.element.type} (r${cell.row}c${cell.col})`,
          kind: "grid" as const,
        }))
      : (template.elements ?? []).map((el) => ({
          id: el.id,
          label: `${el.element.type} · z${el.zIndex}`,
          kind: "freeform" as const,
        }));

  function addElement(type: "text" | "barcode1d" | "qrcode") {
    if (template.layoutMode === "grid") {
      onChange(addGridCell(template, type, undefined, purpose));
    } else {
      onChange(addFreeformElement(template, type, purpose));
    }
  }

  function removeSelected() {
    if (selectedCellId && template.cells) {
      onChange({ ...template, cells: template.cells.filter((c) => c.id !== selectedCellId) });
      setSelectedCellId(null);
    } else if (selectedElementId && template.elements) {
      onChange({ ...template, elements: template.elements.filter((e) => e.id !== selectedElementId) });
      setSelectedElementId(null);
    }
  }

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (disabled) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection && document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          removeSelected();
        }
      }
      if (e.key === "Escape") {
        setSelectedCellId(null);
        setSelectedElementId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-border-subtle p-4 lg:w-56 lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center gap-2 text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Layers className="size-3.5" aria-hidden />
          Layers
        </div>
        <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto lg:max-h-none">
          {layers.length === 0 ? (
            <li className="text-ds-xs text-muted-foreground">No elements yet</li>
          ) : (
            layers.map((layer) => (
              <li key={layer.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-ds-xs",
                    (selectedCellId === layer.id || selectedElementId === layer.id) &&
                      "bg-[var(--accent-subtle)] font-medium text-foreground",
                  )}
                  onClick={() => {
                    if (layer.kind === "grid") {
                      setSelectedCellId(layer.id);
                      setSelectedElementId(null);
                    } else {
                      setSelectedElementId(layer.id);
                      setSelectedCellId(null);
                    }
                  }}
                >
                  {layer.label}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addElement("text")}>
            <Plus className="size-3" aria-hidden />
            Text
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addElement("barcode1d")}>
            Barcode
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addElement("qrcode")}>
            QR
          </Button>
        </div>
        {selection ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-2 w-full text-destructive"
            disabled={disabled}
            onClick={removeSelected}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Remove selected
          </Button>
        ) : null}
      </aside>

      <div className="flex min-h-[320px] min-w-0 flex-1 flex-col p-4 lg:min-h-0">
        <LabelStudioCanvas
          template={template}
          context={context}
          selectedCellId={selectedCellId}
          selectedElementId={selectedElementId}
          onSelectCell={setSelectedCellId}
          onSelectElement={setSelectedElementId}
          onUpdateTemplate={disabled ? undefined : onChange}
          interactive={!disabled}
        />
      </div>

      <aside className="shrink-0 border-t border-border-subtle p-4 lg:w-80 lg:border-l lg:border-t-0 lg:overflow-y-auto">
        <Label className="mb-3 block text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
          Inspector
        </Label>
        <LabelInspectorPanel
          template={template}
          selection={selection}
          onChange={onChange}
          disabled={disabled}
          purpose={purpose}
          onRemoveSelection={() => {
            setSelectedCellId(null);
            setSelectedElementId(null);
          }}
        />
      </aside>
    </div>
  );
}
