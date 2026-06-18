"use client";

import type { LabelElement, LabelTemplate, PositionedElement } from "@/lib/label-template-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

export function FreeformToolbar({
  template,
  selectedId,
  onChange,
  onSelect,
  disabled,
}: {
  template: LabelTemplate;
  selectedId: string | null;
  onChange: (template: LabelTemplate) => void;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}) {
  const elements = template.elements ?? [];

  const addElement = (type: LabelElement["type"]) => {
    let element: LabelElement;
    switch (type) {
      case "text":
        element = {
          type: "text",
          binding: { kind: "serial" },
          style: { fontSizePt: 10, fontWeight: "bold", align: "center" },
        };
        break;
      case "barcode1d":
        element = {
          type: "barcode1d",
          format: "CODE128",
          binding: { kind: "serial" },
          style: { format: "CODE128", heightPx: 32, moduleWidth: 1.3, showValue: false },
        };
        break;
      case "qrcode":
        element = {
          type: "qrcode",
          binding: { kind: "template", value: "https://knot.in/t/{{serial}}" },
          style: {
            errorCorrection: "M",
            foreground: "#000000",
            background: "#ffffff",
            quietZoneMm: 0.5,
            moduleScale: 1,
          },
        };
        break;
      default:
        element = { type: "spacer" };
    }

    const positioned: PositionedElement = {
      id: newId("el"),
      xMm: 5,
      yMm: 5,
      widthMm: 20,
      heightMm: 10,
      zIndex: elements.length,
      element,
    };
    onChange({ ...template, elements: [...elements, positioned] });
    onSelect(positioned.id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    onChange({ ...template, elements: elements.filter((e) => e.id !== selectedId) });
    onSelect(null);
  };

  const selected = elements.find((e) => e.id === selectedId);

  const updateSelected = (patch: Partial<PositionedElement>) => {
    if (!selectedId) return;
    onChange({
      ...template,
      elements: elements.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addElement("text")}>
          <Plus className="size-3.5" aria-hidden />
          Text
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addElement("barcode1d")}>
          Barcode
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addElement("qrcode")}>
          QR
        </Button>
        {selectedId ? (
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={removeSelected}>
            <Trash2 className="size-3.5" aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>

      {selected ? (
        <div className="grid grid-cols-2 gap-2">
          {(["xMm", "yMm", "widthMm", "heightMm"] as const).map((key) => (
            <div key={key} className="space-y-1">
              <Label className="text-ds-2xs">{key}</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={selected[key]}
                disabled={disabled}
                onChange={(e) => updateSelected({ [key]: Number.parseFloat(e.target.value) || 0 })}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
