"use client";

import type {
  FieldBinding,
  GridCell,
  LabelElement,
  LabelTemplate,
  PositionedElement,
} from "@/lib/label-template-types";
import {
  createDefaultFieldBinding,
  fieldBindingOptionsForPurpose,
  type LabelTemplatePurpose,
} from "@/lib/label-template-types";
import { QrStylePanel } from "@/components/label-designer/QrStylePanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Selection =
  | { mode: "grid"; cell: GridCell }
  | { mode: "freeform"; element: PositionedElement }
  | null;

function updateGridCell(
  template: LabelTemplate,
  cellId: string,
  element: LabelElement,
): LabelTemplate {
  if (!template.cells) return template;
  return {
    ...template,
    cells: template.cells.map((c) => (c.id === cellId ? { ...c, element } : c)),
  };
}

function updateFreeformElement(
  template: LabelTemplate,
  elementId: string,
  element: LabelElement,
): LabelTemplate {
  if (!template.elements) return template;
  return {
    ...template,
    elements: template.elements.map((e) =>
      e.id === elementId ? { ...e, element } : e,
    ),
  };
}

function BindingEditor({
  binding,
  onChange,
  disabled,
  purpose = "serial",
}: {
  binding: FieldBinding;
  onChange: (binding: FieldBinding) => void;
  disabled?: boolean;
  purpose?: LabelTemplatePurpose;
}) {
  const options = fieldBindingOptionsForPurpose(purpose);
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label>What should this show?</Label>
        <Select
          value={binding.kind}
          disabled={disabled}
          onValueChange={(kind) =>
            onChange(createDefaultFieldBinding(kind as FieldBinding["kind"], purpose))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.kind} value={opt.kind}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {binding.kind === "static" || binding.kind === "template" ? (
        <div className="space-y-1.5">
          <Label>{binding.kind === "static" ? "Text value" : "URL template"}</Label>
          <Input
            value={binding.value}
            disabled={disabled}
            onChange={(e) => onChange({ ...binding, value: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ElementInspector({
  template,
  selection,
  onChange,
  disabled,
  purpose = "serial",
}: {
  template: LabelTemplate;
  selection: Selection;
  onChange: (template: LabelTemplate) => void;
  disabled?: boolean;
  purpose?: LabelTemplatePurpose;
}) {
  if (!selection) {
    return (
      <p className="text-ds-sm text-muted-foreground">
        Select a cell or element on the canvas to edit its properties.
      </p>
    );
  }

  const element =
    selection.mode === "grid" ? selection.cell.element : selection.element.element;

  const applyElement = (next: LabelElement) => {
    if (selection.mode === "grid") {
      onChange(updateGridCell(template, selection.cell.id, next));
    } else {
      onChange(updateFreeformElement(template, selection.element.id, next));
    }
  };

  if (element.type === "spacer") {
    return <p className="text-ds-sm text-muted-foreground">Empty spacer cell.</p>;
  }

  return (
    <div className="space-y-4">
      <BindingEditor
        binding={element.binding}
        disabled={disabled}
        purpose={purpose}
        onChange={(binding) => applyElement({ ...element, binding } as LabelElement)}
      />

      {element.type === "text" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Font size (pt)</Label>
            <Input
              type="number"
              min={4}
              max={72}
              value={element.style.fontSizePt}
              disabled={disabled}
              onChange={(e) =>
                applyElement({
                  ...element,
                  style: { ...element.style, fontSizePt: Number.parseFloat(e.target.value) || 10 },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Weight</Label>
            <Select
              value={element.style.fontWeight}
              disabled={disabled}
              onValueChange={(value) =>
                applyElement({
                  ...element,
                  style: {
                    ...element.style,
                    fontWeight: value as typeof element.style.fontWeight,
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
                <SelectItem value="extrabold">Extra bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {element.type === "barcode1d" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Bar height (px)</Label>
            <Input
              type="number"
              min={12}
              max={120}
              value={element.style.heightPx}
              disabled={disabled}
              onChange={(e) =>
                applyElement({
                  ...element,
                  style: { ...element.style, heightPx: Number.parseInt(e.target.value, 10) || 32 },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Module width</Label>
            <Input
              type="number"
              min={0.5}
              max={4}
              step={0.1}
              value={element.style.moduleWidth}
              disabled={disabled}
              onChange={(e) =>
                applyElement({
                  ...element,
                  style: {
                    ...element.style,
                    moduleWidth: Number.parseFloat(e.target.value) || 1.4,
                  },
                })
              }
            />
          </div>
        </div>
      ) : null}

      {element.type === "qrcode" ? (
        <QrStylePanel
          style={element.style}
          disabled={disabled}
          onChange={(style) => applyElement({ ...element, style })}
        />
      ) : null}
    </div>
  );
}

export type { Selection as ElementSelection };
