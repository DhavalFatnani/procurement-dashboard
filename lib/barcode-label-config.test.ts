import { SERIES_CODES } from "@/lib/series-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyBarcodeLayoutPreset,
  BARCODE_LAYOUT_PRESETS,
  DEFAULT_BARCODE_LABEL_CONFIG,
  buildBarcodePrintPageCss,
  formatTypographyScalePercent,
  computeLabelContentFitScale,
  fitContentScale,
  getBarcodeControlHints,
  getBarcodeLayoutPresetContext,
  getBarcodeLayoutPresetsForContext,
  getBarcodeLayoutCssVars,
  getLatestBarcodeLabelConfigForLock,
  getPreviewMarginInsets,
  jsBarcodeOptionsFromConfig,
  loadBarcodeLabelDefaults,
  lockBarcodeLabelDefaults,
  normalizeBarcodeLabelConfig,
  parseBarcodeLabelConfig,
  resolveBarcodeTypography,
  saveBarcodeLabelDefaultsDraft,
  unlockBarcodeLabelDefaults,
} from "./barcode-label-config";

describe("parseBarcodeLabelConfig", () => {
  it("returns defaults for invalid JSON", () => {
    expect(parseBarcodeLabelConfig("not-json")).toEqual(DEFAULT_BARCODE_LABEL_CONFIG);
  });

  it("merges valid partial config", () => {
    expect(
      parseBarcodeLabelConfig(
        JSON.stringify({ brandSize: "xlarge", barcodeHeight: 56 }),
      ),
    ).toMatchObject({
      brandSize: "xlarge",
      barcodeHeight: 56,
      pageSize: "a4",
      typographyScale: 1,
    });
  });

  it("parses and clamps typographyScale", () => {
    expect(
      parseBarcodeLabelConfig(JSON.stringify({ typographyScale: 2 })),
    ).toMatchObject({ typographyScale: 1.5 });
    expect(
      parseBarcodeLabelConfig(JSON.stringify({ typographyScale: 0.5 })),
    ).toMatchObject({ typographyScale: 0.75 });
    expect(
      parseBarcodeLabelConfig(JSON.stringify({ typographyScale: 1.12 })),
    ).toMatchObject({ typographyScale: 1.1 });
  });

  it("defaults typographyScale when missing (legacy configs)", () => {
    expect(parseBarcodeLabelConfig(JSON.stringify({ brandSize: "large" }))).toMatchObject({
      typographyScale: 1,
      barcodeValueScale: 1,
      seriesNameScale: 1,
    });
  });

  it("parses and clamps barcodeValueScale and seriesNameScale", () => {
    expect(
      parseBarcodeLabelConfig(
        JSON.stringify({ barcodeValueScale: 1.12, seriesNameScale: 0.82 }),
      ),
    ).toMatchObject({ barcodeValueScale: 1.1, seriesNameScale: 0.8 });
    expect(
      parseBarcodeLabelConfig(JSON.stringify({ barcodeValueScale: 3 })),
    ).toMatchObject({ barcodeValueScale: 2.5 });
    expect(
      parseBarcodeLabelConfig(JSON.stringify({ seriesNameScale: 2.8 })),
    ).toMatchObject({ seriesNameScale: 2.5 });
  });
});

describe("resolveBarcodeTypography", () => {
  it("scales brand font with typographyScale on sheet stock", () => {
    const base = resolveBarcodeTypography(
      { ...DEFAULT_BARCODE_LABEL_CONFIG, brandSize: "large", typographyScale: 1 },
      "sheet",
    );
    const scaled = resolveBarcodeTypography(
      { ...DEFAULT_BARCODE_LABEL_CONFIG, brandSize: "large", typographyScale: 1.2 },
      "sheet",
    );
    expect(scaled.brandFontPt).toBeCloseTo(base.brandFontPt * 1.2, 1);
    expect(scaled.seriesFontPt).toBe(base.seriesFontPt);
    expect(scaled.barcodeValueFontPt).toBe(base.barcodeValueFontPt);
  });

  it("uses smaller bases for label stock", () => {
    const label = resolveBarcodeTypography(
      { ...DEFAULT_BARCODE_LABEL_CONFIG, brandSize: "large", typographyScale: 1 },
      "label",
    );
    const sheet = resolveBarcodeTypography(
      { ...DEFAULT_BARCODE_LABEL_CONFIG, brandSize: "large", typographyScale: 1 },
      "sheet",
    );
    expect(label.brandFontPt).toBeLessThan(sheet.brandFontPt);
    expect(label.seriesFontPt).toBeLessThan(sheet.seriesFontPt);
  });

  it("applies independent barcode and series multipliers", () => {
    const base = resolveBarcodeTypography(DEFAULT_BARCODE_LABEL_CONFIG, "sheet");
    const adjusted = resolveBarcodeTypography(
      {
        ...DEFAULT_BARCODE_LABEL_CONFIG,
        barcodeValueScale: 1.2,
        seriesNameScale: 0.8,
      },
      "sheet",
    );
    expect(adjusted.brandFontPt).toBe(base.brandFontPt);
    expect(adjusted.barcodeValueFontPt).toBeCloseTo(base.barcodeValueFontPt * 1.2, 1);
    expect(adjusted.seriesFontPt).toBeCloseTo(base.seriesFontPt * 0.8, 1);
  });
});

describe("getBarcodeLayoutCssVars", () => {
  it("includes typography CSS variables", () => {
    const vars = getBarcodeLayoutCssVars({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      typographyScale: 1.1,
    });
    expect(vars["--serial-brand-font-pt"]).toMatch(/pt$/);
    expect(vars["--serial-series-font-pt"]).toMatch(/pt$/);
    expect(vars["--serial-barcode-value-font-pt"]).toMatch(/pt$/);
    expect(vars["--serial-brand-letter-spacing"]).toMatch(/em$/);
    expect(vars["--serial-page-width-mm"]).toMatch(/mm$/);
    expect(vars["--serial-page-height-mm"]).toMatch(/mm$/);
    expect(vars["--serial-brand-barcode-gap-mm"]).toBe("6mm");
    expect(vars["--serial-text-gap-mm"]).toBe("4mm");
  });
});

describe("normalizeBarcodeLabelConfig", () => {
  it("fills brandBarcodeGapMm from textGapMm for legacy configs", () => {
    const { brandBarcodeGapMm: _ignored, ...legacy } = DEFAULT_BARCODE_LABEL_CONFIG;
    const normalized = normalizeBarcodeLabelConfig({
      ...legacy,
      textGapMm: 8,
    });
    expect(normalized.brandBarcodeGapMm).toBe(8);
    expect(normalized.textGapMm).toBe(8);
  });
});

describe("parseBarcodeLabelConfig brandBarcodeGapMm", () => {
  it("falls back to textGapMm for saved configs without brand gap", () => {
    const parsed = parseBarcodeLabelConfig(
      JSON.stringify({ ...DEFAULT_BARCODE_LABEL_CONFIG, textGapMm: 8, brandBarcodeGapMm: undefined }),
    );
    expect(parsed.brandBarcodeGapMm).toBe(8);
  });
});

describe("jsBarcodeOptionsFromConfig", () => {
  it("renders bars only without embedded serial text", () => {
    const options = jsBarcodeOptionsFromConfig({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      showBarcodeValue: true,
    });
    expect(options.displayValue).toBe(false);
    expect(options.fontSize).toBe(0);
    expect(options.textMargin).toBe(0);
  });
});

describe("computeLabelContentFitScale", () => {
  it("returns 1 when content fits on sheet stock", () => {
    expect(computeLabelContentFitScale(DEFAULT_BARCODE_LABEL_CONFIG)).toBe(1);
  });

  it("down-scales oversized label stock layouts", () => {
    const scale = computeLabelContentFitScale({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      pageSize: "label-3x2",
      marginMm: 4,
      brandSize: "display",
      typographyScale: 1.5,
      barcodeValueScale: 2.5,
      seriesNameScale: 2.5,
      barcodeHeight: 72,
      barcodeModuleWidth: 3,
      textGapMm: 10,
    });
    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(0.4);
  });
});

describe("fitContentScale", () => {
  it("returns 1 when content fits", () => {
    expect(fitContentScale(100, 80)).toBe(1);
  });

  it("returns ratio when content overflows", () => {
    expect(fitContentScale(50, 100)).toBe(0.5);
  });
});

describe("getBarcodeControlHints", () => {
  it("exposes descriptive copy for setup UI", () => {
    const hints = getBarcodeControlHints();
    expect(hints.serial.title).toContain("Serial");
    expect(hints.knot.title).toMatch(/KNOT/i);
  });
});

describe("applyBarcodeLayoutPreset", () => {
  it("applies jewellery preset fields onto current config", () => {
    const result = applyBarcodeLayoutPreset(
      DEFAULT_BARCODE_LABEL_CONFIG,
      "jewellery-58x40",
      "jewellery",
    );
    expect(result.pageSize).toBe("label-58x40");
    expect(result.brandSize).toBe("large");
    expect(result.barcodeHeight).toBe(36);
  });

  it("applies apparel preset when context is apparel", () => {
    const result = applyBarcodeLayoutPreset(
      DEFAULT_BARCODE_LABEL_CONFIG,
      "apparel-a4-office",
      "apparel",
    );
    expect(result.pageSize).toBe("a4");
  });

  it("returns current config for unknown preset", () => {
    const current = { ...DEFAULT_BARCODE_LABEL_CONFIG, marginMm: 3 };
    expect(applyBarcodeLayoutPreset(current, "unknown", "jewellery")).toEqual(current);
  });

  it("covers all defined presets", () => {
    for (const preset of BARCODE_LAYOUT_PRESETS) {
      const applied = applyBarcodeLayoutPreset(DEFAULT_BARCODE_LABEL_CONFIG, preset.id);
      expect(applied.pageSize).toBe(preset.config.pageSize);
    }
  });
});

describe("getBarcodeLayoutPresetsForContext", () => {
  it("returns jewellery presets for jewellery series", () => {
    expect(getBarcodeLayoutPresetContext(SERIES_CODES.JEWELLERY_BARCODES)).toBe("jewellery");
    const presets = getBarcodeLayoutPresetsForContext("jewellery");
    expect(presets.some((p) => p.id === "jewellery-40x30")).toBe(true);
    expect(presets.some((p) => p.id === "apparel-a4-office")).toBe(false);
  });

  it("returns apparel presets for apparel series", () => {
    expect(getBarcodeLayoutPresetContext(SERIES_CODES.APPAREL_BARCODES)).toBe("apparel");
    const presets = getBarcodeLayoutPresetsForContext("apparel");
    expect(presets.some((p) => p.id === "apparel-100x50")).toBe(true);
    expect(presets.some((p) => p.id === "jewellery-40x30")).toBe(false);
  });
});

describe("formatTypographyScalePercent", () => {
  it("formats scale as percentage", () => {
    expect(formatTypographyScalePercent(1)).toBe("100%");
    expect(formatTypographyScalePercent(1.1)).toBe("110%");
  });
});

describe("buildBarcodePrintPageCss", () => {
  it("uses zero @page margin for label stock (inner padding only)", () => {
    const css = buildBarcodePrintPageCss({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      pageSize: "label-4x6",
      marginMm: 4,
    });
    expect(css).toContain("4in 6in");
    expect(css).toContain("margin: 0");
    expect(css).toContain("page-break-after: always");
    expect(css).toContain("padding: 4mm");
  });

  it("applies margin mm on sheet stock", () => {
    const css = buildBarcodePrintPageCss({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      pageSize: "a4",
      marginMm: 12,
    });
    expect(css).toContain("margin: 12mm");
  });

  it("supports additional sheet sizes", () => {
    const css = buildBarcodePrintPageCss({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      pageSize: "a5",
    });
    expect(css).toContain("A5 portrait");
  });
});

describe("getPreviewMarginInsets", () => {
  it("scales margin by page dimensions", () => {
    const none = getPreviewMarginInsets("a4", 0);
    const minimal = getPreviewMarginInsets("a4", 4);
    const standard = getPreviewMarginInsets("a4", 8);

    expect(none.xPercent).toBe(0);
    expect(minimal.xPercent).toBeCloseTo((4 / 210) * 100, 4);
    expect(standard.xPercent).toBeCloseTo((8 / 210) * 100, 4);
    expect(standard.yPercent).toBeCloseTo((8 / 297) * 100, 4);
  });
});

describe("parseBarcodeLabelConfig legacy margin", () => {
  it("maps old margin enum to marginMm", () => {
    expect(
      parseBarcodeLabelConfig(JSON.stringify({ margin: "minimal" })),
    ).toMatchObject({ marginMm: 4 });
    expect(
      parseBarcodeLabelConfig(JSON.stringify({ margin: "none" })),
    ).toMatchObject({ marginMm: 0 });
  });
});

describe("barcode label defaults lock", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("locks and loads defaults from localStorage", () => {
    const custom = { ...DEFAULT_BARCODE_LABEL_CONFIG, pageSize: "label-58x40" as const };
    lockBarcodeLabelDefaults(custom);

    const loaded = loadBarcodeLabelDefaults();
    expect(loaded.locked).toBe(true);
    expect(loaded.config.pageSize).toBe("label-58x40");
  });

  it("unlock keeps config editable state", () => {
    const custom = { ...DEFAULT_BARCODE_LABEL_CONFIG, marginMm: 0 };
    lockBarcodeLabelDefaults(custom);
    const unlocked = unlockBarcodeLabelDefaults(custom);

    expect(unlocked.locked).toBe(false);
    expect(loadBarcodeLabelDefaults().config.marginMm).toBe(0);
  });

  it("draft save while unlocked does not set locked", () => {
    const custom = { ...DEFAULT_BARCODE_LABEL_CONFIG, marginMm: 0 };
    lockBarcodeLabelDefaults(custom);
    unlockBarcodeLabelDefaults(custom);

    saveBarcodeLabelDefaultsDraft({ ...custom, marginMm: 6 });
    const loaded = loadBarcodeLabelDefaults();
    expect(loaded.locked).toBe(false);
    expect(loaded.config.marginMm).toBe(6);
  });

  it("draft save while locked is ignored", () => {
    const custom = { ...DEFAULT_BARCODE_LABEL_CONFIG, marginMm: 4 };
    lockBarcodeLabelDefaults(custom);

    saveBarcodeLabelDefaultsDraft({ ...custom, marginMm: 12 });
    expect(loadBarcodeLabelDefaults().config.marginMm).toBe(4);
    expect(loadBarcodeLabelDefaults().locked).toBe(true);
  });

  it("lock with latest draft persists all fields when unlocked", () => {
    const latestDraft = { ...DEFAULT_BARCODE_LABEL_CONFIG, marginMm: 12, typographyScale: 1.15 };
    saveBarcodeLabelDefaultsDraft(latestDraft);
    expect(getLatestBarcodeLabelConfigForLock().marginMm).toBe(12);

    lockBarcodeLabelDefaults(getLatestBarcodeLabelConfigForLock());
    const loaded = loadBarcodeLabelDefaults();
    expect(loaded.locked).toBe(true);
    expect(loaded.config.marginMm).toBe(12);
    expect(loaded.config.typographyScale).toBeCloseTo(1.15, 2);
  });

  it("locking with stale config overwrites draft (regression guard)", () => {
    const staleState = { ...DEFAULT_BARCODE_LABEL_CONFIG, marginMm: 8 };
    const latestDraft = { ...DEFAULT_BARCODE_LABEL_CONFIG, marginMm: 12 };

    saveBarcodeLabelDefaultsDraft(latestDraft);
    lockBarcodeLabelDefaults(staleState);

    expect(loadBarcodeLabelDefaults().config.marginMm).toBe(8);
  });
});
