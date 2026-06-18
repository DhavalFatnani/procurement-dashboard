import type {
  GridCell,
  LabelBindingContext,
  LabelElement,
  LabelTemplate,
  PositionedElement,
} from "@/lib/label-template-types";
import { DEFAULT_LABEL_TEXT_COLOR, resolveFieldBinding } from "@/lib/label-template-types";
import { jsBarcodeOptionsFromConfig } from "@/lib/barcode-label-config";
import type { BarcodeLabelConfig } from "@/lib/barcode-label-config";

export type RenderLabelOptions = {
  preview?: boolean;
  scale?: number;
};

const MM_TO_PX = 96 / 25.4;

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

function gridTemplateTracks(tracks: { weight: number }[]): string {
  return tracks.map((t) => `${t.weight}fr`).join(" ");
}

function textStyleCss(style: Extract<LabelElement, { type: "text" }>["style"]): string {
  const weight =
    style.fontWeight === "extrabold" ? "800" : style.fontWeight === "bold" ? "700" : "400";
  return [
    `font-size: ${style.fontSizePt}pt`,
    `font-weight: ${weight}`,
    `text-align: ${style.align}`,
    `color: ${style.color ?? DEFAULT_LABEL_TEXT_COLOR}`,
    style.letterSpacingEm ? `letter-spacing: ${style.letterSpacingEm}em` : "",
    style.uppercase ? "text-transform: uppercase" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function legacyBarcodeConfigFromStyle(
  style: Extract<LabelElement, { type: "barcode1d" }>["style"],
): BarcodeLabelConfig {
  return {
    pageSize: "label-58x40",
    marginMm: 0,
    brandSize: "medium",
    typographyScale: 1,
    barcodeValueScale: 1,
    seriesNameScale: 1,
    brandBarcodeGapMm: 4,
    textGapMm: 4,
    barcodeModuleWidth: style.moduleWidth,
    barcodeMaxWidthPercent: 100,
    showSeriesName: false,
    showBarcodeValue: style.showValue,
    barcodeHeight: style.heightPx,
  };
}

function renderTextElement(
  doc: Document,
  value: string,
  style: Extract<LabelElement, { type: "text" }>["style"],
): HTMLElement {
  const el = doc.createElement("p");
  el.className = "label-el-text";
  el.textContent = value;
  el.style.cssText = `${textStyleCss(style)}; margin: 0; line-height: 1.1; overflow: hidden;`;
  return el;
}

function renderBarcodeElement(
  doc: Document,
  value: string,
  element: Extract<LabelElement, { type: "barcode1d" }>,
  JsBarcode: (el: SVGElement, val: string, opts: object) => void,
  scale = 1,
): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = "label-el-barcode";
  wrap.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%;";

  const trimmed = value.trim();
  if (!trimmed) {
    wrap.textContent = "Barcode";
    wrap.style.cssText += " font-size: 10px; color: #64748b; font-family: ui-sans-serif, system-ui, sans-serif;";
    return wrap;
  }

  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Barcode ${trimmed}`);
  const config = legacyBarcodeConfigFromStyle(element.style);
  try {
    JsBarcode(svg, trimmed, {
      ...jsBarcodeOptionsFromConfig(config, scale),
      height: Math.max(12, Math.round(element.style.heightPx * scale)),
      displayValue: false,
    });
    wrap.appendChild(svg);
  } catch {
    wrap.textContent = "Barcode";
    wrap.style.cssText += " font-size: 10px; color: #64748b; font-family: ui-sans-serif, system-ui, sans-serif;";
    return wrap;
  }

  if (element.style.showValue) {
    const valEl = doc.createElement("p");
    valEl.className = "label-el-barcode-value";
    valEl.textContent = trimmed;
    valEl.style.cssText = `margin: 0; font-size: ${element.style.valueFontSizePt ?? 7}pt; font-family: ui-monospace, monospace; text-align: center; color: ${DEFAULT_LABEL_TEXT_COLOR};`;
    wrap.appendChild(valEl);
  }

  return wrap;
}

async function renderQrElement(
  doc: Document,
  value: string,
  element: Extract<LabelElement, { type: "qrcode" }>,
  sizePx: number,
): Promise<HTMLElement> {
  const wrap = doc.createElement("div");
  wrap.className = "label-el-qrcode";
  wrap.style.cssText = "display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;";

  if (!value) {
    wrap.textContent = "QR";
    return wrap;
  }

  try {
    const QRCode = await import("qrcode");
    const dataUrl = await QRCode.toDataURL(value, {
      errorCorrectionLevel: element.style.errorCorrection,
      color: {
        dark: element.style.foreground,
        light: element.style.background,
      },
      margin: Math.round(element.style.quietZoneMm * MM_TO_PX),
      width: Math.max(32, Math.round(sizePx)),
    });
    const img = doc.createElement("img");
    img.src = dataUrl;
    img.alt = `QR code for ${value}`;
    img.style.cssText = `width: ${sizePx}px; height: ${sizePx}px; object-fit: contain;`;
    wrap.appendChild(img);
  } catch {
    wrap.textContent = "QR";
  }

  return wrap;
}

async function renderElementContent(
  doc: Document,
  element: LabelElement,
  context: LabelBindingContext,
  JsBarcode: (el: SVGElement, val: string, opts: object) => void,
  sizePx: number,
  scale: number,
): Promise<HTMLElement | null> {
  if (element.type === "spacer") {
    const spacer = doc.createElement("div");
    spacer.className = "label-el-spacer";
    return spacer;
  }

  const value = resolveFieldBinding(element.binding, context);

  if (element.type === "text") {
    return renderTextElement(doc, value, element.style);
  }
  if (element.type === "barcode1d") {
    return renderBarcodeElement(doc, value, element, JsBarcode, scale);
  }
  if (element.type === "qrcode") {
    return renderQrElement(doc, value, element, sizePx);
  }
  return null;
}

function renderGridCell(
  doc: Document,
  cell: GridCell,
  cellEl: HTMLElement,
): void {
  cellEl.style.gridRow = cell.rowSpan
    ? `${cell.row + 1} / span ${cell.rowSpan}`
    : `${cell.row + 1}`;
  cellEl.style.gridColumn = cell.colSpan
    ? `${cell.col + 1} / span ${cell.colSpan}`
    : `${cell.col + 1}`;
  cellEl.style.display = "flex";
  cellEl.style.alignItems = "center";
  cellEl.style.justifyContent = "center";
  cellEl.style.overflow = "hidden";
  cellEl.style.minWidth = "0";
  cellEl.style.minHeight = "0";
  if (cell.paddingMm) {
    cellEl.style.padding = `${cell.paddingMm}mm`;
  }
  cellEl.dataset.cellId = cell.id;
}

/** Render a single label into a container element. */
export async function renderLabelToDom(
  template: LabelTemplate,
  context: LabelBindingContext,
  root: HTMLElement,
  options: RenderLabelOptions = {},
): Promise<void> {
  const { default: JsBarcode } = await import("jsbarcode");
  const scale = options.scale ?? 1;
  const doc = root.ownerDocument;

  const printableW = template.page.widthMm - 2 * template.page.marginMm;
  const printableH = template.page.heightMm - 2 * template.page.marginMm;

  root.style.boxSizing = "border-box";
  root.style.width = `${template.page.widthMm}mm`;
  root.style.height = `${template.page.heightMm}mm`;
  root.style.padding = `${template.page.marginMm}mm`;
  root.style.background = "#ffffff";
  root.style.color = DEFAULT_LABEL_TEXT_COLOR;
  root.style.overflow = "hidden";
  root.style.position = "relative";
  root.className = "label-template-root";

  if (template.outerStyle.widthMm > 0) {
    root.style.border = `${template.outerStyle.widthMm}mm solid ${template.outerStyle.color}`;
    if (template.outerStyle.radiusMm) {
      root.style.borderRadius = `${template.outerStyle.radiusMm}mm`;
    }
  }

  const inner = doc.createElement("div");
  inner.className = "label-template-inner";
  inner.style.cssText = `width: 100%; height: 100%; position: relative; overflow: hidden; box-sizing: border-box;`;

  if (template.innerFrame && template.innerFrame.widthMm > 0) {
    inner.style.border = `${template.innerFrame.widthMm}mm solid ${template.innerFrame.color}`;
  }

  if (template.layoutMode === "grid" && template.grid && template.cells) {
    const grid = doc.createElement("div");
    grid.className = "label-template-grid";
    grid.style.display = "grid";
    grid.style.width = "100%";
    grid.style.height = "100%";
    grid.style.gridTemplateRows = gridTemplateTracks(template.grid.rows);
    grid.style.gridTemplateColumns = gridTemplateTracks(template.grid.cols);

    if (template.innerFrame && template.innerFrame.widthMm > 0) {
      grid.style.gap = `${template.innerFrame.widthMm}mm`;
      grid.style.background = template.innerFrame.color;
    }

    for (const cell of template.cells) {
      const cellEl = doc.createElement("div");
      cellEl.className = "label-template-cell";
      cellEl.style.background = "#ffffff";
      renderGridCell(doc, cell, cellEl);

      const contentSize = Math.min(mmToPx(printableW), mmToPx(printableH)) * 0.3;
      const content = await renderElementContent(
        doc,
        cell.element,
        context,
        JsBarcode,
        contentSize,
        scale,
      );
      if (content) {
        cellEl.appendChild(content);
      }
      grid.appendChild(cellEl);
    }

    inner.appendChild(grid);
  } else if (template.elements) {
    const canvas = doc.createElement("div");
    canvas.className = "label-template-canvas";
    canvas.style.cssText = "position: relative; width: 100%; height: 100%;";

    const sorted = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
    for (const positioned of sorted) {
      const el = doc.createElement("div");
      el.className = "label-template-positioned";
      el.style.cssText = [
        "position: absolute",
        `left: ${positioned.xMm}mm`,
        `top: ${positioned.yMm}mm`,
        `width: ${positioned.widthMm}mm`,
        `height: ${positioned.heightMm}mm`,
        "display: flex",
        "align-items: center",
        "justify-content: center",
        "overflow: hidden",
      ].join("; ");
      el.dataset.elementId = positioned.id;

      const sizePx = Math.min(mmToPx(positioned.widthMm), mmToPx(positioned.heightMm));
      const content = await renderElementContent(
        doc,
        positioned.element,
        context,
        JsBarcode,
        sizePx,
        scale,
      );
      if (content) {
        el.appendChild(content);
      }
      canvas.appendChild(el);
    }

    inner.appendChild(canvas);
  }

  root.replaceChildren(inner);
}

export function buildLabelPrintPageCss(template: LabelTemplate): string {
  const pageSize = `${template.page.widthMm}mm ${template.page.heightMm}mm`;
  return `@media print {
  @page {
    size: ${pageSize};
    margin: 0;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
  }
  .label-template-root {
    page-break-after: always;
    break-after: page;
  }
  .label-template-root:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}`;
}

export function buildLabelPrintStylesheet(template: LabelTemplate): string {
  return `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: ${DEFAULT_LABEL_TEXT_COLOR}; }
.label-template-root { color: ${DEFAULT_LABEL_TEXT_COLOR}; }
.label-template-grid { width: 100%; height: 100%; }
.label-el-text { word-break: break-word; color: ${DEFAULT_LABEL_TEXT_COLOR}; }
.label-el-barcode-value { color: ${DEFAULT_LABEL_TEXT_COLOR}; }
.label-el-barcode svg { max-width: 100%; height: auto; }
${buildLabelPrintPageCss(template)}
`;
}

export async function renderLabelBatch(
  container: HTMLElement,
  template: LabelTemplate,
  serials: string[],
  contextBase: Omit<LabelBindingContext, "serial">,
): Promise<HTMLElement> {
  const grid = container.ownerDocument.createElement("div");
  grid.className = "label-print-grid";
  grid.style.cssText = "display: flex; flex-direction: column; align-items: center;";
  container.replaceChildren(grid);

  for (const serial of serials) {
    const label = container.ownerDocument.createElement("article");
    label.className = "label-template-root";
    const context: LabelBindingContext = { ...contextBase, serial };
    await renderLabelToDom(template, context, label);
    grid.appendChild(label);
  }

  return grid;
}

function waitForIframeReady(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    iframe.addEventListener("load", done, { once: true });
    requestAnimationFrame(() => {
      requestAnimationFrame(done);
    });
  });
}

/** Print label grid in an isolated iframe. */
export async function printLabelTemplateGrid(
  grid: HTMLElement,
  template: LabelTemplate,
): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("Could not create print frame");
  }

  const styles = buildLabelPrintStylesheet(template);
  doc.open();
  doc.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Labels</title><style>${styles}</style></head><body></body></html>`);
  doc.close();

  await waitForIframeReady(iframe);

  for (const label of grid.children) {
    doc.body.appendChild(label.cloneNode(true));
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 200);
  });

  win.focus();
  win.print();

  window.setTimeout(() => {
    iframe.remove();
  }, 2000);
}

export type { LabelBindingContext, LabelTemplate, PositionedElement, GridCell };
