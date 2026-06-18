"use client";

import * as React from "react";

import type { ElementSelection } from "@/components/label-designer/ElementInspector";
import { ElementInspector } from "@/components/label-designer/ElementInspector";
import type { GridCell, LabelTemplate, LabelTemplatePurpose, PositionedElement } from "@/lib/label-template-types";
import { removeFreeformElement, removeGridCell } from "@/lib/label-studio-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

function updateGridCellLayout(
  template: LabelTemplate,
  cellId: string,
  patch: Partial<GridCell>,
): LabelTemplate {
  if (!template.cells) return template;
  return {
    ...template,
    cells: template.cells.map((c) => (c.id === cellId ? { ...c, ...patch } : c)),
  };
}

function updateFreeformLayout(
  template: LabelTemplate,
  elementId: string,
  patch: Partial<PositionedElement>,
): LabelTemplate {
  if (!template.elements) return template;
  return {
    ...template,
    elements: template.elements.map((e) => (e.id === elementId ? { ...e, ...patch } : e)),
  };
}

export function LabelInspectorPanel({
  template,
  selection,
  onChange,
  disabled,
  onRemoveSelection,
  purpose = "serial",
}: {
  template: LabelTemplate;
  selection: ElementSelection | null;
  onChange: (template: LabelTemplate) => void;
  disabled?: boolean;
  onRemoveSelection?: () => void;
  purpose?: LabelTemplatePurpose;
}) {
  const [panel, setPanel] = React.useState<"layout" | "properties">("properties");

  if (!selection) {
    return (
      <p className="text-ds-sm text-muted-foreground">
        Select an element on the canvas to edit layout, data, and style.
      </p>
    );
  }

  const sel = selection;

  const layoutFields =
    sel.mode === "grid" ? (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Row</Label>
          <Input
            type="number"
            min={0}
            value={sel.cell.row}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                updateGridCellLayout(template, sel.cell.id, {
                  row: Number.parseInt(e.target.value, 10) || 0,
                }),
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Column</Label>
          <Input
            type="number"
            min={0}
            value={sel.cell.col}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                updateGridCellLayout(template, sel.cell.id, {
                  col: Number.parseInt(e.target.value, 10) || 0,
                }),
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Row span</Label>
          <Input
            type="number"
            min={1}
            value={sel.cell.rowSpan ?? 1}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                updateGridCellLayout(template, sel.cell.id, {
                  rowSpan: Number.parseInt(e.target.value, 10) || 1,
                }),
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Column span</Label>
          <Input
            type="number"
            min={1}
            value={sel.cell.colSpan ?? 1}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                updateGridCellLayout(template, sel.cell.id, {
                  colSpan: Number.parseInt(e.target.value, 10) || 1,
                }),
              )
            }
          />
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3">
        {(["xMm", "yMm", "widthMm", "heightMm"] as const).map((key) => (
          <div key={key} className="space-y-1.5">
            <Label>{key.replace("Mm", " (mm)")}</Label>
            <Input
              type="number"
              step={0.5}
              value={sel.element[key]}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  updateFreeformLayout(template, sel.element.id, {
                    [key]: Number.parseFloat(e.target.value) || 0,
                  }),
                )
              }
            />
          </div>
        ))}
      </div>
    );

  function handleRemove() {
    if (sel.mode === "grid") {
      onChange(removeGridCell(template, sel.cell.id));
    } else if (sel.mode === "freeform") {
      onChange(removeFreeformElement(template, sel.element.id));
    }
    onRemoveSelection?.();
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full text-destructive hover:text-destructive"
        disabled={disabled}
        onClick={handleRemove}
      >
        <Trash2 className="size-3.5" aria-hidden />
        Remove element
      </Button>
      <div className="flex gap-1 rounded-lg border border-border-subtle p-0.5">
        <Button
          type="button"
          size="sm"
          variant={panel === "layout" ? "default" : "ghost"}
          className={cn("h-8 flex-1")}
          onClick={() => setPanel("layout")}
        >
          Layout
        </Button>
        <Button
          type="button"
          size="sm"
          variant={panel === "properties" ? "default" : "ghost"}
          className={cn("h-8 flex-1")}
          onClick={() => setPanel("properties")}
        >
          Properties
        </Button>
      </div>
      {panel === "layout" ? layoutFields : null}
      {panel === "properties" ? (
        <ElementInspector
          template={template}
          selection={selection}
          onChange={onChange}
          disabled={disabled}
          purpose={purpose}
        />
      ) : null}
    </div>
  );
}
