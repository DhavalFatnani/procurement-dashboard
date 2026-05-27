import { describe, expect, it } from "vitest";

import {
  DEFAULT_BARCODE_LABEL_CONFIG,
  getBarcodeLayoutCssVars,
} from "./barcode-label-config";
import {
  buildBarcodePrintHtmlDocument,
  buildBarcodePrintStylesheet,
  getBarcodePrintBarcodeHeight,
  getBarcodePrintCssVars,
} from "./barcode-print-document";

describe("buildBarcodePrintStylesheet", () => {
  it("uses explicit label die dimensions for label stock", () => {
    const css = buildBarcodePrintStylesheet({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      pageSize: "label-3x2",
      marginMm: 4,
    });
    expect(css).toContain("size: 3in 2in");
    expect(css).toContain("width: 76.2mm");
    expect(css).toContain("height: 50.8mm");
    expect(css).toContain("page-break-after: always");
  });

  it("uses sheet page margins for A4", () => {
    const css = buildBarcodePrintStylesheet({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      pageSize: "a4",
      marginMm: 8,
    });
    expect(css).toContain("margin: 8mm");
    expect(css).toContain("min-height: 100vh");
  });
});

describe("buildBarcodePrintHtmlDocument", () => {
  it("embeds stylesheet and hide flags on body", () => {
    const html = buildBarcodePrintHtmlDocument({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      showSeriesName: false,
    });
    expect(html).toContain(".serial-label {");
    expect(html).toContain('data-hide-series="true"');
  });
});

describe("getBarcodePrintCssVars", () => {
  it("reduces typography when layout overflows a small label", () => {
    const tightConfig = {
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      pageSize: "label-3x2" as const,
      brandSize: "display" as const,
      typographyScale: 1.5,
      barcodeValueScale: 2.5,
      barcodeHeight: 72,
      textGapMm: 10,
    };
    const layout = getBarcodeLayoutCssVars(tightConfig);
    const print = getBarcodePrintCssVars(tightConfig);
    expect(parseFloat(print["--serial-brand-font-pt"] ?? "0")).toBeLessThan(
      parseFloat(layout["--serial-brand-font-pt"] ?? "0"),
    );
  });
});

describe("getBarcodePrintBarcodeHeight", () => {
  it("scales bar height down when label is tight", () => {
    const height = getBarcodePrintBarcodeHeight({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      pageSize: "label-3x2",
      brandSize: "display",
      typographyScale: 1.5,
      barcodeValueScale: 2.5,
      barcodeHeight: 72,
      textGapMm: 10,
    });
    expect(height).toBeLessThan(72);
    expect(height).toBeGreaterThanOrEqual(12);
  });
});
