"use client";

import type { GridCell, LabelElement, LabelTemplate } from "@/lib/label-template-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

function defaultElement(type: LabelElement["type"]): LabelElement {
  switch (type) {
    case "text":
      return {
        type: "text",
        binding: { kind: "serial" },
        style: { fontSizePt: 10, fontWeight: "normal", align: "center" },
      };
    case "barcode1d":
      return {
        type: "barcode1d",
        format: "CODE128",
        binding: { kind: "serial" },
        style: { format: "CODE128", heightPx: 32, moduleWidth: 1.3, showValue: false },
      };
    case "qrcode":
      return {
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
    default:
      return { type: "spacer" };
  }
}

export function GridToolbar({
  template,
  onChange,
  disabled,
}: {
  template: LabelTemplate;
  onChange: (template: LabelTemplate) => void;
  disabled?: boolean;
}) {
  const grid = template.grid;
  const cells = template.cells ?? [];

  if (!grid) return null;

  const addRow = () => {
    onChange({
      ...template,
      grid: { ...grid, rows: [...grid.rows, { id: newId("row"), weight: 1 }] },
    });
  };

  const addCol = () => {
    onChange({
      ...template,
      grid: { ...grid, cols: [...grid.cols, { id: newId("col"), weight: 1 }] },
    });
  };

  const addCell = (elementType: LabelElement["type"]) => {
    const cell: GridCell = {
      id: newId("cell"),
      row: 0,
      col: Math.max(0, grid.cols.length - 1),
      element: defaultElement(elementType),
      paddingMm: 0.5,
    };
    onChange({ ...template, cells: [...cells, cell] });
  };

  const removeCell = (cellId: string) => {
    onChange({ ...template, cells: cells.filter((c) => c.id !== cellId) });
  };

  const updateTrackWeight = (
    axis: "rows" | "cols",
    index: number,
    weight: number,
  ) => {
    const tracks = [...grid[axis]];
    const track = tracks[index];
    if (!track) return;
    tracks[index] = { ...track, weight };
    onChange({ ...template, grid: { ...grid, [axis]: tracks } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addRow}>
          <Plus className="size-3.5" aria-hidden />
          Row
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addCol}>
          <Plus className="size-3.5" aria-hidden />
          Column
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addCell("text")}>
          Text
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addCell("barcode1d")}>
          Barcode
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => addCell("qrcode")}>
          QR
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-ds-xs">Row weights</Label>
          {grid.rows.map((row, i) => (
            <Input
              key={row.id}
              type="number"
              min={0.25}
              max={10}
              step={0.1}
              value={row.weight}
              disabled={disabled}
              onChange={(e) => updateTrackWeight("rows", i, Number.parseFloat(e.target.value) || 1)}
            />
          ))}
        </div>
        <div className="space-y-2">
          <Label className="text-ds-xs">Column weights</Label>
          {grid.cols.map((col, i) => (
            <Input
              key={col.id}
              type="number"
              min={0.25}
              max={10}
              step={0.1}
              value={col.weight}
              disabled={disabled}
              onChange={(e) => updateTrackWeight("cols", i, Number.parseFloat(e.target.value) || 1)}
            />
          ))}
        </div>
      </div>

      {cells.length > 0 ? (
        <div className="space-y-1">
          <Label className="text-ds-xs">Cells ({cells.length})</Label>
          <ul className="space-y-1">
            {cells.map((cell) => (
              <li key={cell.id} className="flex items-center justify-between gap-2 text-ds-xs">
                <span className="truncate">
                  {cell.element.type} @ r{cell.row}c{cell.col}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  disabled={disabled}
                  onClick={() => removeCell(cell.id)}
                  aria-label="Remove cell"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
