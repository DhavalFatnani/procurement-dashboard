"use client";

import * as React from "react";

import type { LabelBindingContext, LabelTemplate } from "@/lib/label-template-types";
import {
  dragFreeformElement,
  mmDeltaFromPointer,
  resizeRect,
} from "@/lib/label-studio-canvas-math";
import { mmToPx, renderLabelToDom } from "@/lib/label-template-render";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LabelStudioCanvas({
  template,
  context,
  selectedCellId,
  selectedElementId,
  onSelectCell,
  onSelectElement,
  onUpdateTemplate,
  interactive = true,
  showZoom = true,
  emptyOverlay,
  className,
}: {
  template: LabelTemplate;
  context: LabelBindingContext;
  selectedCellId?: string | null;
  selectedElementId?: string | null;
  onSelectCell?: (cellId: string | null) => void;
  onSelectElement?: (elementId: string | null) => void;
  onUpdateTemplate?: (template: LabelTemplate) => void;
  interactive?: boolean;
  showZoom?: boolean;
  emptyOverlay?: React.ReactNode;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(100);
  const dragRef = React.useRef<{
    elementId: string;
    startClient: { x: number; y: number };
    scale: number;
    mode: "move" | "resize-se";
  } | null>(null);

  const naturalWidthPx = mmToPx(template.page.widthMm);
  const naturalHeightPx = mmToPx(template.page.heightMm);
  const zoomScale = zoom / 100;
  const displayScale = zoomScale;

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;

    void renderLabelToDom(template, context, root, { preview: true, scale: 1 }).then(() => {
      if (cancelled || !rootRef.current) return;

      root.querySelectorAll("[data-cell-id]").forEach((el) => {
        const cellId = (el as HTMLElement).dataset.cellId;
        if (!cellId) return;
        const htmlEl = el as HTMLElement;
        if (interactive) {
          htmlEl.style.cursor = "pointer";
          htmlEl.onclick = (e) => {
            e.stopPropagation();
            onSelectCell?.(cellId);
            onSelectElement?.(null);
          };
        }
        htmlEl.style.outline =
          cellId === selectedCellId ? "2px solid var(--primary)" : "";
        htmlEl.style.outlineOffset = cellId === selectedCellId ? "-1px" : "";
      });

      root.querySelectorAll("[data-element-id]").forEach((el) => {
        const elementId = (el as HTMLElement).dataset.elementId;
        if (!elementId) return;
        const htmlEl = el as HTMLElement;
        if (interactive) {
          htmlEl.style.cursor = "grab";
          htmlEl.onmousedown = (e) => {
            e.stopPropagation();
            onSelectElement?.(elementId);
            onSelectCell?.(null);
            dragRef.current = {
              elementId,
              startClient: { x: e.clientX, y: e.clientY },
              scale: displayScale,
              mode: "move",
            };
          };
        }
        htmlEl.style.outline =
          elementId === selectedElementId ? "2px solid var(--primary)" : "";
        htmlEl.style.outlineOffset = elementId === selectedElementId ? "-1px" : "";
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    template,
    context,
    selectedCellId,
    selectedElementId,
    onSelectCell,
    onSelectElement,
    interactive,
    displayScale,
  ]);

  React.useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag || !onUpdateTemplate) return;
      const { dxMm, dyMm } = mmDeltaFromPointer(drag.startClient, { x: e.clientX, y: e.clientY }, drag.scale);
      if (Math.abs(dxMm) < 0.05 && Math.abs(dyMm) < 0.05) return;

      const element = template.elements?.find((el) => el.id === drag.elementId);
      if (!element) return;

      if (drag.mode === "move") {
        const next = dragFreeformElement(element, dxMm, dyMm, template.page);
        onUpdateTemplate({
          ...template,
          elements: template.elements!.map((el) => (el.id === drag.elementId ? next : el)),
        });
        dragRef.current = { ...drag, startClient: { x: e.clientX, y: e.clientY } };
      } else {
        const resized = resizeRect(
          {
            xMm: element.xMm,
            yMm: element.yMm,
            widthMm: element.widthMm,
            heightMm: element.heightMm,
          },
          "se",
          dxMm,
          dyMm,
          {
            widthMm: template.page.widthMm - template.page.marginMm * 2,
            heightMm: template.page.heightMm - template.page.marginMm * 2,
          },
        );
        onUpdateTemplate({
          ...template,
          elements: template.elements!.map((el) =>
            el.id === drag.elementId ? { ...el, ...resized } : el,
          ),
        });
        dragRef.current = { ...drag, startClient: { x: e.clientX, y: e.clientY } };
      }
    }

    function onUp() {
      dragRef.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [template, onUpdateTemplate, displayScale]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {showZoom ? (
        <div className="mb-3 flex items-center justify-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <span className="w-14 text-center text-ds-xs tabular-nums text-muted-foreground">{zoom}%</span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-auto rounded-xl border border-border-subtle bg-zinc-100/80 p-6"
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
        {emptyOverlay}
        <div
          style={{
            width: naturalWidthPx * displayScale,
            height: naturalHeightPx * displayScale,
          }}
          className="relative shadow-ds"
        >
          <div
            ref={rootRef}
            className="bg-white text-black"
            style={{
              transform: displayScale !== 1 ? `scale(${displayScale})` : undefined,
              transformOrigin: "top left",
              width: `${template.page.widthMm}mm`,
              height: `${template.page.heightMm}mm`,
              color: "#000000",
            }}
          />
        </div>
      </div>
      <p className="mt-2 text-center text-ds-2xs text-muted-foreground">
        {template.page.widthMm} × {template.page.heightMm} mm
      </p>
    </div>
  );
}
