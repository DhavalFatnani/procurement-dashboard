"use client";

import type { LabelTemplate } from "@/lib/label-template-types";
import {
  formatGridCellLabel,
  removeFreeformElement,
  removeGridCell,
} from "@/lib/label-studio-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export function LabelElementList({
  template,
  selectedCellId,
  selectedElementId,
  onSelectCell,
  onSelectElement,
  onChange,
  disabled,
}: {
  template: LabelTemplate;
  selectedCellId?: string | null;
  selectedElementId?: string | null;
  onSelectCell?: (id: string | null) => void;
  onSelectElement?: (id: string | null) => void;
  onChange: (template: LabelTemplate) => void;
  disabled?: boolean;
}) {
  const cells = template.cells ?? [];
  const elements = template.elements ?? [];
  const isEmpty = cells.length === 0 && elements.length === 0;

  function removeCell(cellId: string) {
    onChange(removeGridCell(template, cellId));
    if (selectedCellId === cellId) onSelectCell?.(null);
  }

  function removeElement(elementId: string) {
    onChange(removeFreeformElement(template, elementId));
    if (selectedElementId === elementId) onSelectElement?.(null);
  }

  if (isEmpty) {
    return (
      <p className="text-ds-sm text-muted-foreground">
        No elements yet. Use Add buttons or click the canvas in advanced studio.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5" aria-label="Placed elements">
      {cells.map((cell) => {
        const selected = selectedCellId === cell.id;
        return (
          <li key={cell.id}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                selected
                  ? "border-primary bg-[var(--accent-subtle)]"
                  : "border-border-subtle bg-card",
              )}
            >
              <button
                type="button"
                disabled={disabled}
                className="min-w-0 flex-1 text-left text-ds-xs text-foreground"
                onClick={() => {
                  onSelectCell?.(cell.id);
                  onSelectElement?.(null);
                }}
              >
                {formatGridCellLabel(cell)}
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={disabled}
                aria-label={`Remove ${formatGridCellLabel(cell)}`}
                onClick={() => removeCell(cell.id)}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          </li>
        );
      })}
      {elements.map((el) => {
        const selected = selectedElementId === el.id;
        const typeLabel =
          el.element.type === "barcode1d"
            ? "Barcode"
            : el.element.type === "qrcode"
              ? "QR code"
              : el.element.type === "text"
                ? "Text"
                : "Element";
        return (
          <li key={el.id}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5",
                selected
                  ? "border-primary bg-[var(--accent-subtle)]"
                  : "border-border-subtle bg-card",
              )}
            >
              <button
                type="button"
                disabled={disabled}
                className="min-w-0 flex-1 text-left text-ds-xs text-foreground"
                onClick={() => {
                  onSelectElement?.(el.id);
                  onSelectCell?.(null);
                }}
              >
                {typeLabel} · free-form
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={disabled}
                aria-label={`Remove ${typeLabel}`}
                onClick={() => removeElement(el.id)}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
