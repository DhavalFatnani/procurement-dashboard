"use client";

import * as React from "react";

import type { LabelBindingContext, LabelTemplate } from "@/lib/label-template-types";
import { mmToPx, renderLabelToDom } from "@/lib/label-template-render";
import { cn } from "@/lib/utils";

export function LabelCanvas({
  template,
  context,
  selectedCellId,
  selectedElementId,
  onSelectCell,
  onSelectElement,
  compact = false,
  className,
}: {
  template: LabelTemplate;
  context: LabelBindingContext;
  selectedCellId?: string | null;
  selectedElementId?: string | null;
  onSelectCell?: (cellId: string | null) => void;
  onSelectElement?: (elementId: string | null) => void;
  compact?: boolean;
  className?: string;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const maxWidth = compact ? 280 : 360;
  const naturalWidthPx = mmToPx(template.page.widthMm);
  const naturalHeightPx = mmToPx(template.page.heightMm);
  const frameScale = Math.min(1, maxWidth / naturalWidthPx);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;

    void renderLabelToDom(template, context, root, { preview: true, scale: frameScale }).then(() => {
      if (cancelled || !rootRef.current) return;

      root.querySelectorAll("[data-cell-id]").forEach((el) => {
        const cellId = (el as HTMLElement).dataset.cellId;
        if (!cellId) return;
        const htmlEl = el as HTMLElement;
        htmlEl.style.cursor = "pointer";
        htmlEl.onclick = (e) => {
          e.stopPropagation();
          onSelectCell?.(cellId);
          onSelectElement?.(null);
        };
        if (cellId === selectedCellId) {
          htmlEl.style.outline = "2px solid var(--primary)";
          htmlEl.style.outlineOffset = "-1px";
        } else {
          htmlEl.style.outline = "";
        }
      });

      root.querySelectorAll("[data-element-id]").forEach((el) => {
        const elementId = (el as HTMLElement).dataset.elementId;
        if (!elementId) return;
        const htmlEl = el as HTMLElement;
        htmlEl.style.cursor = "pointer";
        htmlEl.onclick = (e) => {
          e.stopPropagation();
          onSelectElement?.(elementId);
          onSelectCell?.(null);
        };
        if (elementId === selectedElementId) {
          htmlEl.style.outline = "2px solid var(--primary)";
          htmlEl.style.outlineOffset = "-1px";
        } else {
          htmlEl.style.outline = "";
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    template,
    context,
    frameScale,
    selectedCellId,
    selectedElementId,
    onSelectCell,
    onSelectElement,
  ]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!compact ? (
        <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
          Live preview
        </p>
      ) : null}
      <div
        className="mx-auto overflow-hidden rounded-md border border-border-default bg-zinc-200 shadow-ds"
        style={{
          width: naturalWidthPx * frameScale,
          height: naturalHeightPx * frameScale,
        }}
        onClick={() => {
          onSelectCell?.(null);
          onSelectElement?.(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onSelectCell?.(null);
            onSelectElement?.(null);
          }
        }}
        role="presentation"
      >
        <div
          ref={rootRef}
          className="bg-white text-black"
          style={{
            transform: frameScale < 1 ? `scale(${frameScale})` : undefined,
            transformOrigin: "top left",
            width: `${template.page.widthMm}mm`,
            height: `${template.page.heightMm}mm`,
            color: "#000000",
          }}
        />
      </div>
      {!compact ? (
        <p className="text-center text-ds-2xs text-muted-foreground">
          {template.page.widthMm} × {template.page.heightMm} mm
          {frameScale < 1 ? ` · ${Math.round(frameScale * 100)}% scale` : " · actual size"}
        </p>
      ) : null}
    </div>
  );
}
