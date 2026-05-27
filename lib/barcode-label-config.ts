/** Page setup and label layout for internal-print barcode sheets. */
import { SerialSeries } from "@prisma/client";

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

export type BarcodeTypographyMode = "label" | "sheet";

export type BarcodeLabelConfig = {
  pageSize: BarcodePageSize;
  /** Outer safe zone: @page margin on sheets, inner padding on label stock (0–15 mm). */
  marginMm: number;
  brandSize: BarcodeBrandSize;
  /** KNOT brand text scale (0.75–1.5). */
  typographyScale: number;
  /** Serial number under barcode scale multiplier (0.75–1.5). */
  barcodeValueScale: number;
  /** Series name line scale multiplier (0.75–1.5). */
  seriesNameScale: number;
  /** Vertical gap between KNOT branding and the barcode block (2–14 mm). */
  brandBarcodeGapMm: number;
  /** Vertical gap between barcode block, serial, and series lines (2–14 mm). */
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

export type BarcodeTypography = {
  brandFontPt: number;
  seriesFontPt: number;
  barcodeValueFontPt: number;
  letterSpacingEm: number;
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
  typographyScale: 1,
  barcodeValueScale: 1,
  seriesNameScale: 1,
  brandBarcodeGapMm: 6,
  textGapMm: 4,
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
export const BARCODE_TYPOGRAPHY_SCALE_MIN = 0.75;
export const BARCODE_TYPOGRAPHY_SCALE_MAX = 1.5;
export const BARCODE_TYPOGRAPHY_SCALE_STEP = 0.05;

/** Serial digits under the barcode can scale larger than other text lines. */
export const BARCODE_VALUE_SCALE_MIN = 0.75;
export const BARCODE_VALUE_SCALE_MAX = 2.5;
export const BARCODE_VALUE_SCALE_STEP = 0.05;

/** Series name caption can scale larger on small tags, same range as serial. */
export const BARCODE_SERIES_NAME_SCALE_MIN = 0.75;
export const BARCODE_SERIES_NAME_SCALE_MAX = 2.5;
export const BARCODE_SERIES_NAME_SCALE_STEP = 0.05;

export const BARCODE_MARGIN_PRESETS_MM = [0, 4, 8, 12] as const;

const BRAND_BASE_PT: Record<
  BarcodeTypographyMode,
  Record<BarcodeBrandSize, { fontPt: number; letterSpacingEm: number }>
> = {
  label: {
    medium: { fontPt: 8, letterSpacingEm: 0.2 },
    large: { fontPt: 10, letterSpacingEm: 0.24 },
    xlarge: { fontPt: 12, letterSpacingEm: 0.26 },
    xxlarge: { fontPt: 14, letterSpacingEm: 0.28 },
    display: { fontPt: 17, letterSpacingEm: 0.3 },
  },
  sheet: {
    medium: { fontPt: 14, letterSpacingEm: 0.28 },
    large: { fontPt: 22, letterSpacingEm: 0.34 },
    xlarge: { fontPt: 30, letterSpacingEm: 0.36 },
    xxlarge: { fontPt: 38, letterSpacingEm: 0.38 },
    display: { fontPt: 48, letterSpacingEm: 0.4 },
  },
};

const SERIES_BASE_PT: Record<BarcodeTypographyMode, number> = {
  label: 6,
  sheet: 11,
};

const BARCODE_VALUE_BASE_PT: Record<BarcodeTypographyMode, number> = {
  label: 8,
  sheet: 11,
};

const SESSION_PREFIX = "knot-barcode-label-config-";
const DEFAULTS_STORAGE_KEY = "knot-barcode-label-defaults-v1";

export type BarcodeLabelDefaultsState = {
  locked: boolean;
  config: BarcodeLabelConfig;
};

export type BarcodeLayoutPresetContext = "jewellery" | "apparel";

export type BarcodeLayoutPreset = {
  id: string;
  label: string;
  config: Partial<BarcodeLabelConfig>;
};

const JEWELLERY_LAYOUT_PRESETS: BarcodeLayoutPreset[] = [
  {
    id: "jewellery-40x30",
    label: "Small tag 40×30",
    config: {
      pageSize: "label-40x30",
      marginMm: 2,
      brandSize: "medium",
      typographyScale: 0.9,
      barcodeValueScale: 0.95,
      seriesNameScale: 0.9,
      brandBarcodeGapMm: 3,
      textGapMm: 2,
      barcodeModuleWidth: 1.2,
      barcodeMaxWidthPercent: 96,
      barcodeHeight: 28,
    },
  },
  {
    id: "jewellery-58x40",
    label: "Retail thermal 58×40",
    config: {
      pageSize: "label-58x40",
      marginMm: 3,
      brandSize: "large",
      typographyScale: 1,
      barcodeValueScale: 1,
      seriesNameScale: 1,
      brandBarcodeGapMm: 5,
      textGapMm: 3,
      barcodeModuleWidth: 1.4,
      barcodeMaxWidthPercent: 94,
      barcodeHeight: 36,
    },
  },
  {
    id: "jewellery-80x50",
    label: "Shelf 80×50",
    config: {
      pageSize: "label-80x50",
      marginMm: 4,
      brandSize: "xlarge",
      typographyScale: 1,
      barcodeValueScale: 1.05,
      seriesNameScale: 1,
      brandBarcodeGapMm: 6,
      textGapMm: 5,
      barcodeModuleWidth: 1.5,
      barcodeMaxWidthPercent: 92,
      barcodeHeight: 40,
    },
  },
];

const APPAREL_LAYOUT_PRESETS: BarcodeLayoutPreset[] = [
  {
    id: "apparel-58x40",
    label: "Swing tag 58×40",
    config: {
      pageSize: "label-58x40",
      marginMm: 3,
      brandSize: "large",
      typographyScale: 1,
      barcodeValueScale: 1,
      seriesNameScale: 1,
      brandBarcodeGapMm: 5,
      textGapMm: 3,
      barcodeModuleWidth: 1.4,
      barcodeMaxWidthPercent: 94,
      barcodeHeight: 36,
    },
  },
  {
    id: "apparel-100x50",
    label: "Wide shelf 100×50",
    config: {
      pageSize: "label-100x50",
      marginMm: 4,
      brandSize: "xlarge",
      typographyScale: 1.05,
      barcodeValueScale: 1.05,
      seriesNameScale: 1,
      brandBarcodeGapMm: 6,
      textGapMm: 5,
      barcodeModuleWidth: 1.6,
      barcodeMaxWidthPercent: 90,
      barcodeHeight: 44,
    },
  },
  {
    id: "apparel-a4-office",
    label: "Office sheet A4",
    config: {
      pageSize: "a4",
      marginMm: 8,
      brandSize: "xlarge",
      typographyScale: 1,
      barcodeValueScale: 1,
      seriesNameScale: 1,
      brandBarcodeGapMm: 8,
      textGapMm: 6,
      barcodeModuleWidth: 1.6,
      barcodeMaxWidthPercent: 92,
      barcodeHeight: 44,
    },
  },
];

/** @deprecated Use getBarcodeLayoutPresetsForContext */
export const BARCODE_LAYOUT_PRESETS: BarcodeLayoutPreset[] = [
  ...JEWELLERY_LAYOUT_PRESETS,
  ...APPAREL_LAYOUT_PRESETS,
];

export function getBarcodeLayoutPresetContext(series: SerialSeries): BarcodeLayoutPresetContext {
  if (series === SerialSeries.APPAREL_BARCODES) {
    return "apparel";
  }
  return "jewellery";
}

export function getBarcodeLayoutPresetsForContext(
  context: BarcodeLayoutPresetContext,
): BarcodeLayoutPreset[] {
  return context === "apparel" ? APPAREL_LAYOUT_PRESETS : JEWELLERY_LAYOUT_PRESETS;
}

export function getBarcodeLayoutPresetContextLabel(context: BarcodeLayoutPresetContext): string {
  return context === "apparel" ? "Apparel" : "Jewellery";
}

export function getBarcodeLayoutPresetContextHint(context: BarcodeLayoutPresetContext): string {
  return context === "apparel"
    ? "Fashion and garment label stocks common in apparel warehouses."
    : "Retail and jewellery tag sizes for counter and display printing.";
}

export const BARCODE_BRAND_SIZE_CHIPS: {
  value: BarcodeBrandSize;
  label: string;
}[] = [
  { value: "medium", label: "S" },
  { value: "large", label: "M" },
  { value: "xlarge", label: "L" },
  { value: "xxlarge", label: "XL" },
  { value: "display", label: "Hero" },
];

const PAGE_SIZE_VALUES = Object.keys(BARCODE_PAGE_SPECS) as BarcodePageSize[];

export function getBarcodePageSpec(pageSize: BarcodePageSize): BarcodePageSpec {
  return BARCODE_PAGE_SPECS[pageSize];
}

export function isBarcodeLabelStock(pageSize: BarcodePageSize): boolean {
  return BARCODE_PAGE_SPECS[pageSize].group === "label";
}

export function getBarcodeTypographyMode(config: BarcodeLabelConfig): BarcodeTypographyMode {
  return isBarcodeLabelStock(config.pageSize) ? "label" : "sheet";
}

export function resolveBarcodeTypography(
  config: BarcodeLabelConfig,
  mode: BarcodeTypographyMode,
): BarcodeTypography {
  const brandBase = BRAND_BASE_PT[mode][config.brandSize];
  return {
    brandFontPt: roundPt(brandBase.fontPt * config.typographyScale),
    seriesFontPt: roundPt(SERIES_BASE_PT[mode] * config.seriesNameScale),
    barcodeValueFontPt: roundPt(BARCODE_VALUE_BASE_PT[mode] * config.barcodeValueScale),
    letterSpacingEm: brandBase.letterSpacingEm,
  };
}

export type BarcodePreviewHighlight = "knot" | "serial" | "series" | "barcode" | "margin";

/** On-screen preview scales print pt values for legibility in the modal. */
export const BARCODE_LABEL_PREVIEW_SCALE = 0.65;

export function getBarcodeControlHints(): Record<
  BarcodePreviewHighlight | "pageSize" | "brandBarcodeGap" | "textGap" | "showSerial" | "showSeries",
  { title: string; description: string; affects?: string }
> {
  return {
    pageSize: {
      title: "Label stock size",
      description: "Match the physical label or paper loaded in your printer.",
      affects: "The printable area and default text sizes.",
    },
    margin: {
      title: "Safe margin",
      description: "Keeps content away from the label edge or printer non-printable zone.",
      affects: "Shaded border in the preview.",
    },
    showSerial: {
      title: "Serial number under barcode",
      description: "Prints the scannable digits below the bars (e.g. 2000001050).",
      affects: "The monospace number line under the barcode.",
    },
    showSeries: {
      title: "Series / product name",
      description: "Prints the product line name at the bottom of the label.",
      affects: "The bottom caption line.",
    },
    knot: {
      title: "KNOT branding",
      description: "Size of the KNOT word at the top of each label.",
      affects: "Top brand text only.",
    },
    serial: {
      title: "Serial number text",
      description:
        "Font size of the digits printed under the barcode bars. Can go up to 250% for small tags.",
      affects: "Serial line only — does not change KNOT or series name.",
    },
    series: {
      title: "Series name text",
      description:
        "Font size of the product line caption. Can go up to 250% for small tags.",
      affects: "Bottom series line only.",
    },
    barcode: {
      title: "Barcode bars",
      description: "Bar height, thickness, and how much horizontal space the code uses.",
      affects: "The scannable bars in the middle of the label.",
    },
    textGap: {
      title: "Space below barcode",
      description: "Vertical gap between the barcode block, serial number, and series name.",
      affects: "Spacing under the barcode — not between KNOT and the bars.",
    },
    brandBarcodeGap: {
      title: "KNOT to barcode",
      description: "Vertical gap between the KNOT brand line and the barcode block.",
      affects: "Top spacing only — between KNOT and the scannable bars.",
    },
  };
}

export function configMatchesLayoutPreset(
  config: BarcodeLabelConfig,
  preset: BarcodeLayoutPreset,
): boolean {
  for (const [key, value] of Object.entries(preset.config)) {
    const configKey = key as keyof BarcodeLabelConfig;
    if (config[configKey] !== value) {
      return false;
    }
  }
  return true;
}

export function getActiveBarcodeLayoutPresetId(
  config: BarcodeLabelConfig,
  context: BarcodeLayoutPresetContext,
): string | null {
  for (const preset of getBarcodeLayoutPresetsForContext(context)) {
    if (configMatchesLayoutPreset(config, preset)) {
      return preset.id;
    }
  }
  return null;
}

function roundPt(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatTypographyScalePercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

export function applyBarcodeLayoutPreset(
  current: BarcodeLabelConfig,
  presetId: string,
  context?: BarcodeLayoutPresetContext,
): BarcodeLabelConfig {
  const presets = context
    ? getBarcodeLayoutPresetsForContext(context)
    : BARCODE_LAYOUT_PRESETS;
  const preset = presets.find((p) => p.id === presetId);
  if (!preset) {
    return current;
  }
  return parseBarcodeLabelConfig(
    JSON.stringify({ ...current, ...preset.config }),
  );
}

function clampTypographyScale(value: number): number {
  return clampNumber(
    Math.round(value / BARCODE_TYPOGRAPHY_SCALE_STEP) * BARCODE_TYPOGRAPHY_SCALE_STEP,
    BARCODE_TYPOGRAPHY_SCALE_MIN,
    BARCODE_TYPOGRAPHY_SCALE_MAX,
  );
}

export function clampBarcodeValueScale(value: number): number {
  return clampNumber(
    Math.round(value / BARCODE_VALUE_SCALE_STEP) * BARCODE_VALUE_SCALE_STEP,
    BARCODE_VALUE_SCALE_MIN,
    BARCODE_VALUE_SCALE_MAX,
  );
}

export function clampSeriesNameScale(value: number): number {
  return clampNumber(
    Math.round(value / BARCODE_SERIES_NAME_SCALE_STEP) * BARCODE_SERIES_NAME_SCALE_STEP,
    BARCODE_SERIES_NAME_SCALE_MIN,
    BARCODE_SERIES_NAME_SCALE_MAX,
  );
}

export function isBarcodeLabelConfigDefault(config: BarcodeLabelConfig): boolean {
  return JSON.stringify(config) === JSON.stringify(DEFAULT_BARCODE_LABEL_CONFIG);
}

/** Latest config from localStorage — use when locking to avoid stale React state. */
export function getLatestBarcodeLabelConfigForLock(): BarcodeLabelConfig {
  return loadBarcodeLabelDefaults().config;
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
  const mode = getBarcodeTypographyMode(config);
  const typography = resolveBarcodeTypography(config, mode);
  const pageSpec = getBarcodePageSpec(config.pageSize);
  return {
    "--serial-margin-mm": `${config.marginMm}mm`,
    "--serial-brand-barcode-gap-mm": `${config.brandBarcodeGapMm}mm`,
    "--serial-text-gap-mm": `${config.textGapMm}mm`,
    "--serial-barcode-max-width": `${config.barcodeMaxWidthPercent}%`,
    "--serial-brand-font-pt": `${typography.brandFontPt}pt`,
    "--serial-series-font-pt": `${typography.seriesFontPt}pt`,
    "--serial-barcode-value-font-pt": `${typography.barcodeValueFontPt}pt`,
    "--serial-brand-letter-spacing": `${typography.letterSpacingEm}em`,
    "--serial-page-width-mm": `${pageSpec.widthMm}mm`,
    "--serial-page-height-mm": `${pageSpec.heightMm}mm`,
    "--serial-fit-scale": String(computeLabelContentFitScale(config)),
  };
}

export function fitContentScale(availablePx: number, neededPx: number): number {
  if (availablePx <= 0 || neededPx <= 0 || neededPx <= availablePx) {
    return 1;
  }
  return availablePx / neededPx;
}

function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}

/** Estimate uniform down-scale so label content fits the printable die height. */
export function computeLabelContentFitScale(config: BarcodeLabelConfig): number {
  if (!isBarcodeLabelStock(config.pageSize)) {
    return 1;
  }
  const spec = getBarcodePageSpec(config.pageSize);
  const typography = resolveBarcodeTypography(config, getBarcodeTypographyMode(config));
  const printableHeightMm = Math.max(1, spec.heightMm - 2 * config.marginMm);

  let contentHeightMm = ptToMm(typography.brandFontPt);
  contentHeightMm += (config.barcodeHeight / 96) * 25.4;
  if (config.showBarcodeValue) {
    contentHeightMm += ptToMm(typography.barcodeValueFontPt) * 1.15;
  }
  if (config.showSeriesName) {
    contentHeightMm += ptToMm(typography.seriesFontPt) * 1.2;
  }

  const stackGapCount =
    (config.showBarcodeValue ? 1 : 0) + (config.showSeriesName ? 1 : 0);
  contentHeightMm += config.brandBarcodeGapMm + stackGapCount * config.textGapMm;

  return fitContentScale(printableHeightMm * 0.97, contentHeightMm);
}

/** Scale label content down when it exceeds the printable area (label stock). */
export function applyLabelContentFitScale(label: HTMLElement): number {
  const content = label.querySelector(".serial-label-content");
  if (!(content instanceof HTMLElement)) {
    return 1;
  }
  const available = label.clientHeight;
  if (available <= 0) {
    return 1;
  }
  content.style.transform = "none";
  const needed = content.scrollHeight;
  const scale = fitContentScale(available, needed);
  if (scale < 1) {
    content.style.transform = `scale(${scale})`;
    content.style.transformOrigin = "center center";
  }
  return scale;
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
    JSON.stringify(normalizeBarcodeLabelConfig(config)),
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
  localStorage.setItem(
    DEFAULTS_STORAGE_KEY,
    JSON.stringify({
      locked: state.locked,
      config: normalizeBarcodeLabelConfig(state.config),
    }),
  );
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
    return buildBarcodeLabelConfig(parsed);
  } catch {
    return DEFAULT_BARCODE_LABEL_CONFIG;
  }
}

/** Fill defaults and clamp fields — use before persisting or binding to controlled inputs. */
export function normalizeBarcodeLabelConfig(
  config: Partial<BarcodeLabelConfig> & { margin?: unknown },
): BarcodeLabelConfig {
  return parseBarcodeLabelConfig(JSON.stringify(config));
}

function buildBarcodeLabelConfig(
  parsed: Partial<BarcodeLabelConfig> & { margin?: unknown },
): BarcodeLabelConfig {
  try {
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
      typographyScale:
        typeof parsed.typographyScale === "number"
          ? clampTypographyScale(parsed.typographyScale)
          : DEFAULT_BARCODE_LABEL_CONFIG.typographyScale,
      barcodeValueScale:
        typeof parsed.barcodeValueScale === "number"
          ? clampBarcodeValueScale(parsed.barcodeValueScale)
          : DEFAULT_BARCODE_LABEL_CONFIG.barcodeValueScale,
      seriesNameScale:
        typeof parsed.seriesNameScale === "number"
          ? clampSeriesNameScale(parsed.seriesNameScale)
          : DEFAULT_BARCODE_LABEL_CONFIG.seriesNameScale,
      brandBarcodeGapMm:
        typeof parsed.brandBarcodeGapMm === "number"
          ? clampNumber(
              Math.round(parsed.brandBarcodeGapMm),
              BARCODE_TEXT_GAP_MM_MIN,
              BARCODE_TEXT_GAP_MM_MAX,
            )
          : typeof parsed.textGapMm === "number"
            ? clampNumber(
                Math.round(parsed.textGapMm),
                BARCODE_TEXT_GAP_MM_MIN,
                BARCODE_TEXT_GAP_MM_MAX,
              )
            : DEFAULT_BARCODE_LABEL_CONFIG.brandBarcodeGapMm,
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
  const labelStock = isBarcodeLabelStock(config.pageSize);
  // Label stock is already sized to the die — margins are inner padding only.
  const pageMargin = labelStock ? "0" : `${config.marginMm}mm`;
  const labelPadding = labelStock ? `${config.marginMm}mm` : "0";

  const labelPageRules = labelStock
    ? `
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
  }

  #serial-barcode-print-root {
    position: static !important;
    inset: auto !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
  }

  #serial-barcode-print-root .serial-label-grid {
    margin: 0;
    padding: 0;
  }

  #serial-barcode-print-root .serial-label {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 0;
    max-height: none;
    margin: 0;
    padding: ${labelPadding};
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  #serial-barcode-print-root .serial-label:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  #serial-barcode-print-root .serial-label-content {
    transform: scale(var(--serial-fit-scale, 1));
    transform-origin: center center;
  }`
    : `
  #serial-barcode-print-root .serial-label {
    box-sizing: border-box;
    display: flex;
    width: 100%;
    min-height: 100vh;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  #serial-barcode-print-root .serial-label:last-child {
    page-break-after: auto;
    break-after: auto;
  }`;

  return `@media print {
  @page {
    size: ${pageSize};
    margin: ${pageMargin};
  }
${labelPageRules}
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
  if (!config.showBarcodeValue) {
    root.dataset.hideSerialValue = "true";
  } else {
    delete root.dataset.hideSerialValue;
  }

  const spec = getBarcodePageSpec(config.pageSize);
  root.style.width = `${spec.widthMm}mm`;
}

export function jsBarcodeOptionsFromConfig(
  config: BarcodeLabelConfig,
  scale = 1,
) {
  const height = Math.max(12, Math.round(config.barcodeHeight * scale));
  return {
    format: "CODE128" as const,
    displayValue: false,
    font: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 0,
    textMargin: 0,
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
