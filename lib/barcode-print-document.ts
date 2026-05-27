import type { BarcodeLabelConfig } from "@/lib/barcode-label-config";
import {
  computeLabelContentFitScale,
  getBarcodeLayoutCssVars,
  getBarcodePageSpec,
  isBarcodeLabelStock,
} from "@/lib/barcode-label-config";

/** CSS vars with fit-scale baked into typography (no transform in print). */
export function getBarcodePrintCssVars(config: BarcodeLabelConfig): Record<string, string> {
  const fit = computeLabelContentFitScale(config);
  const base = getBarcodeLayoutCssVars(config);

  if (fit >= 0.999) {
    return base;
  }

  const scalePt = (key: string): string => {
    const value = parseFloat(base[key] ?? "0");
    return `${Math.round(value * fit * 10) / 10}pt`;
  };

  const gapMm = parseFloat(base["--serial-text-gap-mm"] ?? "0");
  const brandGapMm = parseFloat(base["--serial-brand-barcode-gap-mm"] ?? "0");

  return {
    ...base,
    "--serial-brand-font-pt": scalePt("--serial-brand-font-pt"),
    "--serial-series-font-pt": scalePt("--serial-series-font-pt"),
    "--serial-barcode-value-font-pt": scalePt("--serial-barcode-value-font-pt"),
    "--serial-brand-barcode-gap-mm": `${Math.round(brandGapMm * fit * 10) / 10}mm`,
    "--serial-text-gap-mm": `${Math.round(gapMm * fit * 10) / 10}mm`,
    "--serial-fit-scale": "1",
  };
}

export function getBarcodePrintBarcodeHeight(config: BarcodeLabelConfig): number {
  const fit = computeLabelContentFitScale(config);
  return Math.max(12, Math.round(config.barcodeHeight * fit));
}

/** Self-contained stylesheet for an isolated iframe print document. */
export function buildBarcodePrintStylesheet(config: BarcodeLabelConfig): string {
  const spec = getBarcodePageSpec(config.pageSize);
  const labelStock = isBarcodeLabelStock(config.pageSize);
  const vars = getBarcodePrintCssVars(config);
  const rootVars = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");

  const pageMargin = labelStock ? "0" : `${config.marginMm}mm`;
  const labelPadding = labelStock ? `${config.marginMm}mm` : "0";
  const labelSize = labelStock
    ? `width: ${spec.widthMm}mm; height: ${spec.heightMm}mm;`
    : "width: 100%; min-height: 100vh;";

  return `
:root {
${rootVars}
}

@page {
  size: ${spec.cssSize};
  margin: ${pageMargin};
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: #fff;
}

.serial-label {
  ${labelSize}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: ${labelPadding};
  overflow: hidden;
  background: #fff;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  break-inside: avoid;
}

.serial-label:last-child {
  page-break-after: auto;
  break-after: auto;
}

.serial-label-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 100%;
}

.serial-label-brand {
  margin: 0 0 var(--serial-brand-barcode-gap-mm, 4mm);
  color: #111;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: var(--serial-brand-font-pt, 22pt);
  font-weight: 800;
  letter-spacing: var(--serial-brand-letter-spacing, 0.34em);
  line-height: 1;
  text-transform: uppercase;
}

.serial-label-barcode {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5mm;
  width: min(var(--serial-barcode-max-width, 92%), 100%);
}

.serial-label-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--serial-text-gap-mm, 4mm);
  width: 100%;
  max-width: 100%;
}

.serial-label-barcode svg {
  display: block;
  max-width: 100%;
  height: auto;
}

.serial-label-value {
  margin: 0;
  max-width: 100%;
  overflow: hidden;
  color: #111;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--serial-barcode-value-font-pt, 11pt);
  line-height: 1.1;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

body[data-hide-serial-value="true"] .serial-label-value {
  display: none;
}

.serial-label-series {
  margin: 0;
  max-width: min(92%, 100%);
  overflow: hidden;
  color: #444;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: var(--serial-series-font-pt, 11pt);
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

body[data-hide-series="true"] .serial-label-series {
  display: none;
}
`;
}

export function buildBarcodePrintHtmlDocument(config: BarcodeLabelConfig): string {
  const bodyAttrs: string[] = [];
  if (!config.showSeriesName) {
    bodyAttrs.push('data-hide-series="true"');
  }
  if (!config.showBarcodeValue) {
    bodyAttrs.push('data-hide-serial-value="true"');
  }

  const styles = buildBarcodePrintStylesheet(config);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Barcode labels</title>
<style>${styles}</style>
</head>
<body ${bodyAttrs.join(" ")}></body>
</html>`;
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

/** Print label grid in an isolated iframe — reliable multi-page OS print preview. */
export async function printBarcodeLabelGrid(
  grid: HTMLElement,
  config: BarcodeLabelConfig,
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

  doc.open();
  doc.write(buildBarcodePrintHtmlDocument(config));
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
