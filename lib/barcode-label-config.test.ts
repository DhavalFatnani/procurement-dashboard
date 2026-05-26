import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_BARCODE_LABEL_CONFIG,
  buildBarcodePrintPageCss,
  getPreviewMarginInsets,
  loadBarcodeLabelDefaults,
  lockBarcodeLabelDefaults,
  parseBarcodeLabelConfig,
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
    });
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
});
