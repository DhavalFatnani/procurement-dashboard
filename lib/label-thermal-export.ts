import type { LabelBindingContext, LabelTemplate } from "@/lib/label-template-types";
import { resolveFieldBinding } from "@/lib/label-template-types";

/** Printer resolution: 203 DPI (8 dots/mm) — common for Zebra thermal printers. */
export const THERMAL_DPI = 203;
export const DOTS_PER_MM = THERMAL_DPI / 25.4;

export function mmToDots(mm: number): number {
  return Math.round(mm * DOTS_PER_MM);
}

function dotsToZplCoord(dots: number): number {
  return Math.max(0, dots);
}

type ThermalElement = {
  type: "text" | "barcode" | "qr" | "box";
  x: number;
  y: number;
  content?: string;
  width?: number;
  height?: number;
  fontHeight?: number;
  fontWidth?: number;
};

function collectGridElements(
  template: LabelTemplate,
  context: LabelBindingContext,
): ThermalElement[] {
  const elements: ThermalElement[] = [];
  if (!template.grid || !template.cells) return elements;

  const rowWeights = template.grid.rows.map((r) => r.weight);
  const colWeights = template.grid.cols.map((c) => c.weight);
  const totalRowWeight = rowWeights.reduce((a, b) => a + b, 0);
  const totalColWeight = colWeights.reduce((a, b) => a + b, 0);

  const innerW = template.page.widthMm - 2 * template.page.marginMm;
  const innerH = template.page.heightMm - 2 * template.page.marginMm;
  const gapMm = template.innerFrame?.widthMm ?? 0;

  const rowHeights = rowWeights.map((w) => (w / totalRowWeight) * (innerH - gapMm * (rowWeights.length - 1)));
  const colWidths = colWeights.map((w) => (w / totalColWeight) * (innerW - gapMm * (colWeights.length - 1)));

  const marginDots = mmToDots(template.page.marginMm);
  const originX = marginDots;
  const originY = marginDots;

  for (const cell of template.cells) {
    if (cell.element.type === "spacer") continue;

    let xMm = template.page.marginMm;
    for (let c = 0; c < cell.col; c++) {
      xMm += colWidths[c] ?? 0;
      if (c < cell.col) xMm += gapMm;
    }
    let yMm = template.page.marginMm;
    for (let r = 0; r < cell.row; r++) {
      yMm += rowHeights[r] ?? 0;
      if (r < cell.row) yMm += gapMm;
    }

    let wMm = 0;
    const colSpan = cell.colSpan ?? 1;
    for (let c = cell.col; c < cell.col + colSpan; c++) {
      wMm += colWidths[c] ?? 0;
      if (c < cell.col + colSpan - 1) wMm += gapMm;
    }
    let hMm = 0;
    const rowSpan = cell.rowSpan ?? 1;
    for (let r = cell.row; r < cell.row + rowSpan; r++) {
      hMm += rowHeights[r] ?? 0;
      if (r < cell.row + rowSpan - 1) hMm += gapMm;
    }

    const x = originX + mmToDots(xMm - template.page.marginMm);
    const y = originY + mmToDots(yMm - template.page.marginMm);
    const w = mmToDots(wMm);
    const h = mmToDots(hMm);

    const value = resolveFieldBinding(cell.element.binding, context);

    if (cell.element.type === "text") {
      elements.push({
        type: "text",
        x,
        y: y + Math.round(h * 0.35),
        content: value,
        fontHeight: mmToDots(cell.element.style.fontSizePt * 0.35),
        fontWidth: mmToDots(cell.element.style.fontSizePt * 0.3),
      });
    } else if (cell.element.type === "barcode1d") {
      elements.push({
        type: "barcode",
        x,
        y,
        content: value,
        height: mmToDots((cell.element.style.heightPx / 96) * 25.4),
        width: w,
      });
    } else if (cell.element.type === "qrcode") {
      const size = Math.min(w, h);
      elements.push({
        type: "qr",
        x: x + Math.round((w - size) / 2),
        y: y + Math.round((h - size) / 2),
        content: value,
        width: size,
        height: size,
      });
    }
  }

  return elements;
}

function collectFreeformElements(
  template: LabelTemplate,
  context: LabelBindingContext,
): ThermalElement[] {
  const elements: ThermalElement[] = [];
  if (!template.elements) return elements;

  const marginDots = mmToDots(template.page.marginMm);

  for (const positioned of template.elements) {
    if (positioned.element.type === "spacer") continue;

    const x = marginDots + mmToDots(positioned.xMm);
    const y = marginDots + mmToDots(positioned.yMm);
    const w = mmToDots(positioned.widthMm);
    const h = mmToDots(positioned.heightMm);
    const value = resolveFieldBinding(positioned.element.binding, context);

    if (positioned.element.type === "text") {
      elements.push({
        type: "text",
        x,
        y: y + Math.round(h * 0.35),
        content: value,
        fontHeight: mmToDots(positioned.element.style.fontSizePt * 0.35),
        fontWidth: mmToDots(positioned.element.style.fontSizePt * 0.3),
      });
    } else if (positioned.element.type === "barcode1d") {
      elements.push({
        type: "barcode",
        x,
        y,
        content: value,
        height: mmToDots((positioned.element.style.heightPx / 96) * 25.4),
        width: w,
      });
    } else if (positioned.element.type === "qrcode") {
      const size = Math.min(w, h);
      elements.push({
        type: "qr",
        x: x + Math.round((w - size) / 2),
        y: y + Math.round((h - size) / 2),
        content: value,
        width: size,
        height: size,
      });
    }
  }

  return elements;
}

function zplElementLines(el: ThermalElement): string[] {
  const lines: string[] = [];
  const x = dotsToZplCoord(el.x);
  const y = dotsToZplCoord(el.y);

  if (el.type === "text" && el.content) {
    const fh = el.fontHeight ?? 24;
    const fw = el.fontWidth ?? 20;
    lines.push(`^FO${x},${y}^A0N,${fh},${fw}^FD${el.content}^FS`);
  } else if (el.type === "barcode" && el.content) {
    const barH = el.height ?? 50;
    lines.push(`^FO${x},${y}^BY2^BCN,${barH},N,N,N^FD${el.content}^FS`);
  } else if (el.type === "qr" && el.content) {
    const size = el.width ?? 80;
    const mag = Math.max(1, Math.round(size / 50));
    lines.push(`^FO${x},${y}^BQN,2,${mag}^FDQA,${el.content}^FS`);
  } else if (el.type === "box" && el.width && el.height) {
    const thickness = 2;
    lines.push(`^FO${x},${y}^GB${el.width},${el.height},${thickness}^FS`);
  }

  return lines;
}

/** Generate ZPL for a single label. */
export function generateZpl(
  template: LabelTemplate,
  context: LabelBindingContext,
): string {
  const widthDots = mmToDots(template.page.widthMm);
  const heightDots = mmToDots(template.page.heightMm);

  const elements =
    template.layoutMode === "grid"
      ? collectGridElements(template, context)
      : collectFreeformElements(template, context);

  const borderLines: string[] = [];
  if (template.outerStyle.widthMm > 0) {
    const margin = mmToDots(template.page.marginMm);
    const innerW = widthDots - 2 * margin;
    const innerH = heightDots - 2 * margin;
    borderLines.push(`^FO${margin},${margin}^GB${innerW},${innerH},${mmToDots(template.outerStyle.widthMm)}^FS`);
  }

  const body = [...borderLines, ...elements.flatMap(zplElementLines)].join("\n");

  return `^XA
^PW${widthDots}
^LL${heightDots}
^LH0,0
${body}
^XZ`;
}

function eplElementLines(el: ThermalElement): string[] {
  const lines: string[] = [];
  const x = dotsToZplCoord(el.x);
  const y = dotsToZplCoord(el.y);

  if (el.type === "text" && el.content) {
    lines.push(`A${x},${y},0,3,1,1,N,"${el.content.replace(/"/g, "'")}"`);
  } else if (el.type === "barcode" && el.content) {
    const barH = el.height ?? 50;
    lines.push(`B${x},${y},0,1,2,4,${barH},N,"${el.content}"`);
  } else if (el.type === "qr" && el.content) {
    const size = el.width ?? 80;
    lines.push(`b${x},${y},Q,s${size},eM,r0,t0,"${el.content.replace(/"/g, "'")}"`);
  }

  return lines;
}

/** Generate EPL for a single label. */
export function generateEpl(
  template: LabelTemplate,
  context: LabelBindingContext,
): string {
  const widthDots = mmToDots(template.page.widthMm);
  const heightDots = mmToDots(template.page.heightMm);

  const elements =
    template.layoutMode === "grid"
      ? collectGridElements(template, context)
      : collectFreeformElements(template, context);

  const body = elements.flatMap(eplElementLines).join("\n");

  return `N
q${widthDots}
Q${heightDots},24
${body}
P1
`;
}

/** Batch ZPL for multiple label contexts in one file. */
export function generateZplBatchForContexts(
  template: LabelTemplate,
  contexts: LabelBindingContext[],
): string {
  return contexts
    .map((context) =>
      generateZpl(template, context).replace(/^\^XA\n?/, "").replace(/\n?\^XZ$/, ""),
    )
    .map((body) => `^XA\n${body}\n^XZ`)
    .join("\n");
}

/** Batch EPL for multiple label contexts. */
export function generateEplBatchForContexts(
  template: LabelTemplate,
  contexts: LabelBindingContext[],
): string {
  return contexts.map((context) => generateEpl(template, context)).join("\n");
}

/** Batch ZPL for multiple serials in one file. */
export function generateZplBatch(
  template: LabelTemplate,
  serials: string[],
  contextBase: Omit<LabelBindingContext, "serial">,
): string {
  return generateZplBatchForContexts(
    template,
    serials.map((serial) => ({ ...contextBase, serial })),
  );
}

/** Batch EPL for multiple serials. */
export function generateEplBatch(
  template: LabelTemplate,
  serials: string[],
  contextBase: Omit<LabelBindingContext, "serial">,
): string {
  return generateEplBatchForContexts(
    template,
    serials.map((serial) => ({ ...contextBase, serial })),
  );
}

export function downloadThermalFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
