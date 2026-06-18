import type { PositionedElement } from "@/lib/label-template-types";

export type MmRect = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

export function clampMm(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nudgeRect(
  rect: MmRect,
  dxMm: number,
  dyMm: number,
  bounds: { widthMm: number; heightMm: number },
): MmRect {
  const maxX = Math.max(0, bounds.widthMm - rect.widthMm);
  const maxY = Math.max(0, bounds.heightMm - rect.heightMm);
  return {
    ...rect,
    xMm: clampMm(rect.xMm + dxMm, 0, maxX),
    yMm: clampMm(rect.yMm + dyMm, 0, maxY),
  };
}

export function resizeRect(
  rect: MmRect,
  handle: "se" | "e" | "s",
  dxMm: number,
  dyMm: number,
  bounds: { widthMm: number; heightMm: number },
  minSizeMm = 4,
): MmRect {
  const { xMm, yMm } = rect;
  let { widthMm, heightMm } = rect;

  if (handle === "e" || handle === "se") {
    widthMm = clampMm(widthMm + dxMm, minSizeMm, bounds.widthMm - xMm);
  }
  if (handle === "s" || handle === "se") {
    heightMm = clampMm(heightMm + dyMm, minSizeMm, bounds.heightMm - yMm);
  }

  return { xMm, yMm, widthMm, heightMm };
}

export function dragFreeformElement(
  element: PositionedElement,
  dxMm: number,
  dyMm: number,
  page: { widthMm: number; heightMm: number; marginMm: number },
): PositionedElement {
  const innerWidth = page.widthMm - page.marginMm * 2;
  const innerHeight = page.heightMm - page.marginMm * 2;
  const nudged = nudgeRect(
    {
      xMm: element.xMm,
      yMm: element.yMm,
      widthMm: element.widthMm,
      heightMm: element.heightMm,
    },
    dxMm,
    dyMm,
    { widthMm: innerWidth, heightMm: innerHeight },
  );
  return { ...element, ...nudged };
}

export function mmDeltaFromPointer(
  startClient: { x: number; y: number },
  currentClient: { x: number; y: number },
  scale: number,
): { dxMm: number; dyMm: number } {
  const pxPerMm = scale > 0 ? scale : 1;
  return {
    dxMm: (currentClient.x - startClient.x) / pxPerMm,
    dyMm: (currentClient.y - startClient.y) / pxPerMm,
  };
}
