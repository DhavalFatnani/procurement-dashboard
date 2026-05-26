/** Page setup and label layout for internal-print barcode sheets. */
export type BarcodePageSize =
  | "a4"
  | "a5"
  | "letter"
  | "legal"
  | "label-40x30"
  | "label-50x25"
  | "label-58x40"
  | "label-80x50"
  | "label-100x50"
  | "label-100x150"
  | "label-2x1"
  | "label-3x2"
  | "label-4x6";

/** @deprecated Parsed from legacy saved configs only */
export type BarcodePageMargin = "default" | "minimal" | "none";

export type BarcodeBrandSize =
  | "medium"
  | "large"
  | "xlarge"
  | "xxlarge"
  | "display";

export type BarcodeLabelConfig = {
  pageSize: BarcodePageSize;
  /** Outer safe zone: @page margin on sheets, inner padding on label stock (0–15 mm). */
  marginMm: number;
  brandSize: BarcodeBrandSize;
  /** Vertical gap between KNOT, barcode, and series text (2–14 mm). */
  textGapMm: number;
  /** JsBarcode module width — bar thickness / horizontal scale (1–3). */
  barcodeModuleWidth: number;
  /** Max width of the barcode block as % of printable area (70–100). */
  barcodeMaxWidthPercent: number;
  showSeriesName: boolean;
  showBarcodeValue: boolean;
  /** JsBarcode bar height in px (scannable density). */
  barcodeHeight: number;
};

export type BarcodePageSpec = {
  label: string;
  hint: string;
  group: "sheet" | "label";
  /** Value for CSS `@page { size: … }`. */
  cssSize: string;
  /** Portrait aspect ratio width ÷ height for preview framing. */
  aspectRatio: number;
  widthMm: number;
  heightMm: number;
};

export const BARCODE_PAGE_SPECS: Record<BarcodePageSize, BarcodePageSpec> = {
  a4: {
    label: "A4 (210 × 297 mm)",
    hint: "One label centred per A4 sheet",
    group: "sheet",
    cssSize: "A4 portrait",
    aspectRatio: 210 / 297,
    widthMm: 210,
    heightMm: 297,
  },
  a5: {
    label: "A5 (148 × 210 mm)",
    hint: "One label centred per A5 sheet",
    group: "sheet",
    cssSize: "A5 portrait",
    aspectRatio: 148 / 210,
    widthMm: 148,
    heightMm: 210,
  },
  letter: {
    label: "US Letter (8.5 × 11 in)",
    hint: "One label centred per letter sheet",
    group: "sheet",
    cssSize: "letter portrait",
    aspectRatio: 8.5 / 11,
    widthMm: 215.9,
    heightMm: 279.4,
  },
  legal: {
    label: "US Legal (8.5 × 14 in)",
    hint: "One label centred per legal sheet",
    group: "sheet",
    cssSize: "legal portrait",
    aspectRatio: 8.5 / 14,
    widthMm: 215.9,
    heightMm: 355.6,
  },
  "label-40x30": {
    label: "40 × 30 mm",
    hint: "Small thermal / jewellery tag stock",
    group: "label",
    cssSize: "40mm 30mm",
    aspectRatio: 40 / 30,
    widthMm: 40,
    heightMm: 30,
  },
  "label-50x25": {
    label: "50 × 25 mm",
    hint: "Narrow thermal label roll",
    group: "label",
    cssSize: "50mm 25mm",
    aspectRatio: 50 / 25,
    widthMm: 50,
    heightMm: 25,
  },
  "label-58x40": {
    label: "58 × 40 mm",
    hint: "Standard retail thermal label",
    group: "label",
    cssSize: "58mm 40mm",
    aspectRatio: 58 / 40,
    widthMm: 58,
    heightMm: 40,
  },
  "label-80x50": {
    label: "80 × 50 mm",
    hint: "Medium shipping / shelf label",
    group: "label",
    cssSize: "80mm 50mm",
    aspectRatio: 80 / 50,
    widthMm: 80,
    heightMm: 50,
  },
  "label-100x50": {
    label: "100 × 50 mm",
    hint: "Wide logistics label",
    group: "label",
    cssSize: "100mm 50mm",
    aspectRatio: 100 / 50,
    widthMm: 100,
    heightMm: 50,
  },
  "label-100x150": {
    label: "100 × 150 mm",
    hint: "Tall parcel label",
    group: "label",
    cssSize: "100mm 150mm",
    aspectRatio: 100 / 150,
    widthMm: 100,
    heightMm: 150,
  },
  "label-2x1": {
    label: "2 × 1 in",
    hint: "Small US address label",
    group: "label",
    cssSize: "2in 1in",
    aspectRatio: 2 / 1,
    widthMm: 50.8,
    heightMm: 25.4,
  },
  "label-3x2": {
    label: "3 × 2 in",
    hint: "Common US product label",
    group: "label",
    cssSize: "3in 2in",
    aspectRatio: 3 / 2,
    widthMm: 76.2,
    heightMm: 50.8,
  },
  "label-4x6": {
    label: "4 × 6 in",
    hint: "US shipping / postage label",
    group: "label",
    cssSize: "4in 6in",
    aspectRatio: 4 / 6,
    widthMm: 101.6,
    heightMm: 152.4,
  },
};

export const DEFAULT_BARCODE_LABEL_CONFIG: BarcodeLabelConfig = {
  pageSize: "a4",
  marginMm: 8,
  brandSize: "large",
  textGapMm: 6,
  barcodeModuleWidth: 1.6,
  barcodeMaxWidthPercent: 92,
  showSeriesName: true,
  showBarcodeValue: true,
  barcodeHeight: 44,
};

export const BARCODE_MARGIN_MM_MIN = 0;
export const BARCODE_MARGIN_MM_MAX = 15;
export const BARCODE_TEXT_GAP_MM_MIN = 2;
export const BARCODE_TEXT_GAP_MM_MAX = 14;
export const BARCODE_MODULE_WIDTH_MIN = 1;
export const BARCODE_MODULE_WIDTH_MAX = 3;
export const BARCODE_MAX_WIDTH_PERCENT_MIN = 70;
export const BARCODE_MAX_WIDTH_PERCENT_MAX = 100;

export const BARCODE_MARGIN_PRESETS_MM = [0, 4, 8, 12] as const;

const SESSION_PREFIX = "knot-barcode-label-config-";
const DEFAULTS_STORAGE_KEY = "knot-barcode-label-defaults-v1";

export type BarcodeLabelDefaultsState = {
  locked: boolean;
  config: BarcodeLabelConfig;
};

const PAGE_SIZE_VALUES = Object.keys(BARCODE_PAGE_SPECS) as BarcodePageSize[];

export function getBarcodePageSpec(pageSize: BarcodePageSize): BarcodePageSpec {
  return BARCODE_PAGE_SPECS[pageSize];
}

export function isBarcodeLabelStock(pageSize: BarcodePageSize): boolean {
  return BARCODE_PAGE_SPECS[pageSize].group === "label";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function legacyMarginToMm(margin: unknown): number | undefined {
  if (margin === "none") return 0;
  if (margin === "minimal") return 4;
  if (margin === "default") return 8;
  return undefined;
}

/** CSS custom properties shared by print root and on-screen preview. */
export function getBarcodeLayoutCssVars(config: BarcodeLabelConfig): Record<string, string> {
  return {
    "--serial-margin-mm": `${config.marginMm}mm`,
    "--serial-text-gap-mm": `${config.textGapMm}mm`,
    "--serial-barcode-max-width": `${config.barcodeMaxWidthPercent}%`,
  };
}

export function getPreviewMarginInsets(
  pageSize: BarcodePageSize,
  marginMm: number,
): { xPercent: number; yPercent: number; marginMm: number; label: string } {
  const spec = getBarcodePageSpec(pageSize);
  const xPercent = spec.widthMm > 0 ? (marginMm / spec.widthMm) * 100 : 0;
  const yPercent = spec.heightMm > 0 ? (marginMm / spec.heightMm) * 100 : 0;

  return {
    xPercent,
    yPercent,
    marginMm,
    label: marginMm === 0 ? "no margins" : `${marginMm} mm margins`,
  };
}

export const BARCODE_PAGE_SIZE_GROUPS: {
  id: "sheet" | "label";
  label: string;
}[] = [
  { id: "sheet", label: "Paper sheets" },
  { id: "label", label: "Label stock" },
];

export const BARCODE_PAGE_SIZE_OPTIONS = PAGE_SIZE_VALUES.map((value) => ({
  value,
  ...BARCODE_PAGE_SPECS[value],
}));

export function barcodeLabelConfigSessionKey(reservationId: string): string {
  return `${SESSION_PREFIX}${reservationId}`;
}

export function saveBarcodeLabelConfigToSession(
  reservationId: string,
  config: BarcodeLabelConfig,
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(
    barcodeLabelConfigSessionKey(reservationId),
    JSON.stringify(config),
  );
}

export function loadBarcodeLabelConfigFromSession(
  reservationId: string,
): BarcodeLabelConfig {
  if (typeof sessionStorage === "undefined") {
    return loadBarcodeLabelDefaults().config;
  }
  const raw = sessionStorage.getItem(barcodeLabelConfigSessionKey(reservationId));
  if (!raw) {
    return loadBarcodeLabelDefaults().config;
  }
  return parseBarcodeLabelConfig(raw);
}

/** Saved default layout for internal print (localStorage, survives sessions). */
export function loadBarcodeLabelDefaults(): BarcodeLabelDefaultsState {
  if (typeof localStorage === "undefined") {
    return { locked: false, config: DEFAULT_BARCODE_LABEL_CONFIG };
  }
  const raw = localStorage.getItem(DEFAULTS_STORAGE_KEY);
  if (!raw) {
    return { locked: false, config: DEFAULT_BARCODE_LABEL_CONFIG };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BarcodeLabelDefaultsState>;
    return {
      locked: parsed.locked === true,
      config: parseBarcodeLabelConfig(JSON.stringify(parsed.config ?? {})),
    };
  } catch {
    return { locked: false, config: DEFAULT_BARCODE_LABEL_CONFIG };
  }
}

function persistBarcodeLabelDefaults(state: BarcodeLabelDefaultsState): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(state));
}

/** Lock the current layout as the default for all future internal prints. */
export function lockBarcodeLabelDefaults(config: BarcodeLabelConfig): BarcodeLabelDefaultsState {
  const state: BarcodeLabelDefaultsState = { locked: true, config };
  persistBarcodeLabelDefaults(state);
  return state;
}

/** Unlock so the user can edit; keeps the current config as a starting point. */
export function unlockBarcodeLabelDefaults(config: BarcodeLabelConfig): BarcodeLabelDefaultsState {
  const state: BarcodeLabelDefaultsState = { locked: false, config };
  persistBarcodeLabelDefaults(state);
  return state;
}

/** Persist draft layout while unlocked (not applied as locked default). */
export function saveBarcodeLabelDefaultsDraft(config: BarcodeLabelConfig): void {
  const current = loadBarcodeLabelDefaults();
  if (current.locked) {
    return;
  }
  persistBarcodeLabelDefaults({ locked: false, config });
}

export function parseBarcodeLabelConfig(raw: string): BarcodeLabelConfig {
  try {
    const parsed = JSON.parse(raw) as Partial<BarcodeLabelConfig> & {
      margin?: unknown;
    };
    const legacyMargin =
      legacyMarginToMm(parsed.margin) ??
      (typeof parsed.marginMm === "number" ? parsed.marginMm : undefined);

    return {
      pageSize: isPageSize(parsed.pageSize) ? parsed.pageSize : DEFAULT_BARCODE_LABEL_CONFIG.pageSize,
      marginMm:
        legacyMargin !== undefined
          ? clampNumber(Math.round(legacyMargin), BARCODE_MARGIN_MM_MIN, BARCODE_MARGIN_MM_MAX)
          : DEFAULT_BARCODE_LABEL_CONFIG.marginMm,
      brandSize: isBrandSize(parsed.brandSize)
        ? parsed.brandSize
        : DEFAULT_BARCODE_LABEL_CONFIG.brandSize,
      textGapMm:
        typeof parsed.textGapMm === "number"
          ? clampNumber(
              Math.round(parsed.textGapMm),
              BARCODE_TEXT_GAP_MM_MIN,
              BARCODE_TEXT_GAP_MM_MAX,
            )
          : DEFAULT_BARCODE_LABEL_CONFIG.textGapMm,
      barcodeModuleWidth:
        typeof parsed.barcodeModuleWidth === "number"
          ? clampNumber(
              Math.round(parsed.barcodeModuleWidth * 10) / 10,
              BARCODE_MODULE_WIDTH_MIN,
              BARCODE_MODULE_WIDTH_MAX,
            )
          : DEFAULT_BARCODE_LABEL_CONFIG.barcodeModuleWidth,
      barcodeMaxWidthPercent:
        typeof parsed.barcodeMaxWidthPercent === "number"
          ? clampNumber(
              Math.round(parsed.barcodeMaxWidthPercent),
              BARCODE_MAX_WIDTH_PERCENT_MIN,
              BARCODE_MAX_WIDTH_PERCENT_MAX,
            )
          : DEFAULT_BARCODE_LABEL_CONFIG.barcodeMaxWidthPercent,
      showSeriesName:
        typeof parsed.showSeriesName === "boolean"
          ? parsed.showSeriesName
          : DEFAULT_BARCODE_LABEL_CONFIG.showSeriesName,
      showBarcodeValue:
        typeof parsed.showBarcodeValue === "boolean"
          ? parsed.showBarcodeValue
          : DEFAULT_BARCODE_LABEL_CONFIG.showBarcodeValue,
      barcodeHeight:
        typeof parsed.barcodeHeight === "number" &&
        parsed.barcodeHeight >= 20 &&
        parsed.barcodeHeight <= 72
          ? Math.round(parsed.barcodeHeight)
          : DEFAULT_BARCODE_LABEL_CONFIG.barcodeHeight,
    };
  } catch {
    return DEFAULT_BARCODE_LABEL_CONFIG;
  }
}

function isPageSize(value: unknown): value is BarcodePageSize {
  return typeof value === "string" && value in BARCODE_PAGE_SPECS;
}

function isBrandSize(value: unknown): value is BarcodeBrandSize {
  return (
    value === "medium" ||
    value === "large" ||
    value === "xlarge" ||
    value === "xxlarge" ||
    value === "display"
  );
}

/** Injected into document head so @page rules match the chosen setup. */
export function buildBarcodePrintPageCss(config: BarcodeLabelConfig): string {
  const pageSize = getBarcodePageSpec(config.pageSize).cssSize;
  // Label stock is already sized to the die — margins are inner padding only.
  const pageMargin = isBarcodeLabelStock(config.pageSize)
    ? "0"
    : `${config.marginMm}mm`;

  return `@media print {
  @page {
    size: ${pageSize};
    margin: ${pageMargin};
  }
}`;
}

export function applyBarcodeLabelConfigToRoot(
  root: HTMLElement,
  config: BarcodeLabelConfig,
): void {
  root.dataset.pageSize = config.pageSize;
  root.dataset.brandSize = config.brandSize;
  root.dataset.labelsPerPage = "1";
  const layoutVars = getBarcodeLayoutCssVars(config);
  for (const [key, value] of Object.entries(layoutVars)) {
    root.style.setProperty(key, value);
  }
  if (isBarcodeLabelStock(config.pageSize)) {
    root.dataset.labelStock = "true";
  } else {
    delete root.dataset.labelStock;
  }
  if (!config.showSeriesName) {
    root.dataset.hideSeries = "true";
  } else {
    delete root.dataset.hideSeries;
  }

  let styleEl = document.getElementById("serial-barcode-print-page-style");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "serial-barcode-print-page-style";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildBarcodePrintPageCss(config);
}

export function jsBarcodeOptionsFromConfig(
  config: BarcodeLabelConfig,
  scale = 1,
) {
  const height = Math.max(12, Math.round(config.barcodeHeight * scale));
  return {
    format: "CODE128" as const,
    displayValue: config.showBarcodeValue,
    font: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: config.showBarcodeValue ? Math.max(8, Math.round(11 * scale)) : 0,
    textMargin: config.showBarcodeValue ? Math.max(1, Math.round(2 * scale)) : 0,
    height,
    width: Math.max(0.5, config.barcodeModuleWidth * scale),
    margin: 0,
    textAlign: "center" as const,
  };
}

export const BARCODE_BRAND_SIZE_OPTIONS: { value: BarcodeBrandSize; label: string }[] = [
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large (recommended)" },
  { value: "xxlarge", label: "2× large" },
  { value: "display", label: "Display / hero" },
];
