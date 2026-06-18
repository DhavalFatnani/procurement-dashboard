import type { LabelTemplate } from "@/lib/label-template-types";

export const KNOT_REFERENCE_PRESET_ID = "knot-grid-reference";

export const KNOT_REFERENCE_PRESET_NAME = "KNOT Grid (Reference)";

/** Built-in preset matching the KNOT reference layout. */
export const KNOT_REFERENCE_PRESET: LabelTemplate = {
  version: 1,
  layoutMode: "grid",
  page: {
    widthMm: 58,
    heightMm: 40,
    marginMm: 2,
  },
  outerStyle: {
    color: "#2563eb",
    widthMm: 0.6,
    radiusMm: 2,
  },
  innerFrame: {
    color: "#000000",
    widthMm: 0.25,
  },
  grid: {
    rows: [
      { id: "row-top", weight: 1.4 },
      { id: "row-bottom", weight: 1 },
    ],
    cols: [
      { id: "col-brand", weight: 0.85 },
      { id: "col-barcode", weight: 1.6 },
      { id: "col-qr", weight: 1 },
    ],
  },
  cells: [
    {
      id: "cell-brand",
      row: 0,
      col: 0,
      rowSpan: 2,
      element: {
        type: "text",
        binding: { kind: "static", value: "KNOT" },
        style: {
          fontSizePt: 11,
          fontWeight: "extrabold",
          align: "center",
          letterSpacingEm: 0.28,
          uppercase: true,
          color: "#000000",
        },
      },
      paddingMm: 1,
    },
    {
      id: "cell-barcode",
      row: 0,
      col: 1,
      element: {
        type: "barcode1d",
        format: "CODE128",
        binding: { kind: "serial" },
        style: {
          format: "CODE128",
          heightPx: 32,
          moduleWidth: 1.3,
          showValue: false,
        },
      },
      paddingMm: 0.5,
    },
    {
      id: "cell-qr",
      row: 0,
      col: 2,
      element: {
        type: "qrcode",
        binding: { kind: "template", value: "https://knot.in/t/{{serial}}" },
        style: {
          errorCorrection: "M",
          foreground: "#000000",
          background: "#ffffff",
          quietZoneMm: 0.5,
          moduleScale: 1,
        },
      },
      paddingMm: 0.5,
    },
    {
      id: "cell-serial",
      row: 1,
      col: 1,
      colSpan: 2,
      element: {
        type: "text",
        binding: { kind: "serial" },
        style: {
          fontSizePt: 10,
          fontWeight: "bold",
          align: "center",
          color: "#000000",
        },
      },
      paddingMm: 0.5,
    },
  ],
};

export type LabelTemplatePreset = {
  id: string;
  name: string;
  description: string;
  template: LabelTemplate;
};

const DEFAULT_OUTER: LabelTemplate["outerStyle"] = {
  color: "#2563eb",
  widthMm: 0.5,
  radiusMm: 1.5,
};

const DEFAULT_INNER: NonNullable<LabelTemplate["innerFrame"]> = {
  color: "#000000",
  widthMm: 0.2,
};

/** Classic vertical stack: brand, barcode, serial, series. */
export const VERTICAL_CLASSIC_PRESET: LabelTemplate = {
  version: 1,
  layoutMode: "grid",
  page: { widthMm: 58, heightMm: 40, marginMm: 2 },
  outerStyle: { color: "#1e293b", widthMm: 0.4, radiusMm: 1 },
  innerFrame: DEFAULT_INNER,
  grid: {
    rows: [
      { id: "v-row-brand", weight: 0.7 },
      { id: "v-row-barcode", weight: 1.6 },
      { id: "v-row-serial", weight: 0.8 },
      { id: "v-row-series", weight: 0.5 },
    ],
    cols: [{ id: "v-col-main", weight: 1 }],
  },
  cells: [
    {
      id: "v-cell-brand",
      row: 0,
      col: 0,
      element: {
        type: "text",
        binding: { kind: "static", value: "KNOT" },
        style: { fontSizePt: 10, fontWeight: "bold", align: "center", letterSpacingEm: 0.2 },
      },
      paddingMm: 0.5,
    },
    {
      id: "v-cell-barcode",
      row: 1,
      col: 0,
      element: {
        type: "barcode1d",
        format: "CODE128",
        binding: { kind: "serial" },
        style: { format: "CODE128", heightPx: 36, moduleWidth: 1.2, showValue: false },
      },
      paddingMm: 0.5,
    },
    {
      id: "v-cell-serial",
      row: 2,
      col: 0,
      element: {
        type: "text",
        binding: { kind: "serial" },
        style: { fontSizePt: 9, fontWeight: "bold", align: "center" },
      },
      paddingMm: 0.25,
    },
    {
      id: "v-cell-series",
      row: 3,
      col: 0,
      element: {
        type: "text",
        binding: { kind: "seriesName" },
        style: { fontSizePt: 6, fontWeight: "normal", align: "center", color: "#555555" },
      },
      paddingMm: 0.25,
    },
  ],
};

/** Small tag: barcode with serial number only. */
export const MINIMAL_BARCODE_PRESET: LabelTemplate = {
  version: 1,
  layoutMode: "grid",
  page: { widthMm: 50, heightMm: 25, marginMm: 1.5 },
  outerStyle: { color: "#000000", widthMm: 0.3, radiusMm: 0.5 },
  grid: {
    rows: [
      { id: "m-row-barcode", weight: 1.5 },
      { id: "m-row-serial", weight: 0.6 },
    ],
    cols: [{ id: "m-col-main", weight: 1 }],
  },
  cells: [
    {
      id: "m-cell-barcode",
      row: 0,
      col: 0,
      element: {
        type: "barcode1d",
        format: "CODE128",
        binding: { kind: "serial" },
        style: { format: "CODE128", heightPx: 28, moduleWidth: 1.1, showValue: false },
      },
      paddingMm: 0.5,
    },
    {
      id: "m-cell-serial",
      row: 1,
      col: 0,
      element: {
        type: "text",
        binding: { kind: "serial" },
        style: { fontSizePt: 7, fontWeight: "bold", align: "center" },
      },
      paddingMm: 0.25,
    },
  ],
};

/** QR code prominent with serial below — ideal for mobile scan workflows. */
export const QR_FORWARD_PRESET: LabelTemplate = {
  version: 1,
  layoutMode: "grid",
  page: { widthMm: 58, heightMm: 40, marginMm: 2 },
  outerStyle: DEFAULT_OUTER,
  innerFrame: DEFAULT_INNER,
  grid: {
    rows: [
      { id: "q-row-qr", weight: 2 },
      { id: "q-row-serial", weight: 0.7 },
    ],
    cols: [{ id: "q-col-main", weight: 1 }],
  },
  cells: [
    {
      id: "q-cell-qr",
      row: 0,
      col: 0,
      element: {
        type: "qrcode",
        binding: { kind: "template", value: "https://knot.in/t/{{serial}}" },
        style: {
          errorCorrection: "M",
          foreground: "#000000",
          background: "#ffffff",
          quietZoneMm: 0.4,
          moduleScale: 1.1,
        },
      },
      paddingMm: 0.5,
    },
    {
      id: "q-cell-serial",
      row: 1,
      col: 0,
      element: {
        type: "text",
        binding: { kind: "serial" },
        style: { fontSizePt: 9, fontWeight: "bold", align: "center" },
      },
      paddingMm: 0.25,
    },
  ],
};

/** Barcode and QR side by side with serial band — no brand column. */
export const DUAL_SCAN_PRESET: LabelTemplate = {
  version: 1,
  layoutMode: "grid",
  page: { widthMm: 58, heightMm: 40, marginMm: 2 },
  outerStyle: DEFAULT_OUTER,
  innerFrame: DEFAULT_INNER,
  grid: {
    rows: [
      { id: "d-row-top", weight: 1.5 },
      { id: "d-row-bottom", weight: 0.8 },
    ],
    cols: [
      { id: "d-col-barcode", weight: 1.4 },
      { id: "d-col-qr", weight: 1 },
    ],
  },
  cells: [
    {
      id: "d-cell-barcode",
      row: 0,
      col: 0,
      element: {
        type: "barcode1d",
        format: "CODE128",
        binding: { kind: "serial" },
        style: { format: "CODE128", heightPx: 32, moduleWidth: 1.2, showValue: false },
      },
      paddingMm: 0.5,
    },
    {
      id: "d-cell-qr",
      row: 0,
      col: 1,
      element: {
        type: "qrcode",
        binding: { kind: "serial" },
        style: {
          errorCorrection: "M",
          foreground: "#000000",
          background: "#ffffff",
          quietZoneMm: 0.4,
          moduleScale: 1,
        },
      },
      paddingMm: 0.5,
    },
    {
      id: "d-cell-serial",
      row: 1,
      col: 0,
      colSpan: 2,
      element: {
        type: "text",
        binding: { kind: "serial" },
        style: { fontSizePt: 10, fontWeight: "bold", align: "center" },
      },
      paddingMm: 0.5,
    },
  ],
};

/** Wide retail shelf label: brand, barcode, serial in one row. */
export const WIDE_RETAIL_PRESET: LabelTemplate = {
  version: 1,
  layoutMode: "grid",
  page: { widthMm: 100, heightMm: 50, marginMm: 2 },
  outerStyle: { color: "#2563eb", widthMm: 0.5, radiusMm: 2 },
  innerFrame: DEFAULT_INNER,
  grid: {
    rows: [{ id: "w-row-main", weight: 1 }],
    cols: [
      { id: "w-col-brand", weight: 0.6 },
      { id: "w-col-barcode", weight: 1.8 },
      { id: "w-col-serial", weight: 0.9 },
    ],
  },
  cells: [
    {
      id: "w-cell-brand",
      row: 0,
      col: 0,
      element: {
        type: "text",
        binding: { kind: "static", value: "KNOT" },
        style: { fontSizePt: 12, fontWeight: "extrabold", align: "center", uppercase: true },
      },
      paddingMm: 1,
    },
    {
      id: "w-cell-barcode",
      row: 0,
      col: 1,
      element: {
        type: "barcode1d",
        format: "CODE128",
        binding: { kind: "serial" },
        style: { format: "CODE128", heightPx: 40, moduleWidth: 1.4, showValue: false },
      },
      paddingMm: 0.5,
    },
    {
      id: "w-cell-serial",
      row: 0,
      col: 2,
      element: {
        type: "text",
        binding: { kind: "serial" },
        style: { fontSizePt: 11, fontWeight: "bold", align: "center" },
      },
      paddingMm: 0.5,
    },
  ],
};

/** Empty 2×2 grid — start from scratch in later steps. */
export const BLANK_GRID_PRESET: LabelTemplate = {
  version: 1,
  layoutMode: "grid",
  page: { widthMm: 58, heightMm: 40, marginMm: 2 },
  outerStyle: { color: "#94a3b8", widthMm: 0.4, radiusMm: 1, },
  innerFrame: { color: "#cbd5e1", widthMm: 0.15 },
  grid: {
    rows: [
      { id: "b-row-top", weight: 1 },
      { id: "b-row-bottom", weight: 1 },
    ],
    cols: [
      { id: "b-col-left", weight: 1 },
      { id: "b-col-right", weight: 1 },
    ],
  },
  cells: [],
};

export const BUILT_IN_LABEL_PRESETS: LabelTemplatePreset[] = [
  {
    id: KNOT_REFERENCE_PRESET_ID,
    name: KNOT_REFERENCE_PRESET_NAME,
    description: "Brand column with barcode, QR, and serial band",
    template: KNOT_REFERENCE_PRESET,
  },
  {
    id: "vertical-classic",
    name: "Vertical classic",
    description: "Stacked brand, barcode, serial, and series name",
    template: VERTICAL_CLASSIC_PRESET,
  },
  {
    id: "dual-scan",
    name: "Dual scan",
    description: "Barcode and QR side by side with serial below",
    template: DUAL_SCAN_PRESET,
  },
  {
    id: "qr-forward",
    name: "QR forward",
    description: "Large QR code with serial number underneath",
    template: QR_FORWARD_PRESET,
  },
  {
    id: "minimal-barcode",
    name: "Minimal barcode",
    description: "Compact 50×25 mm tag with barcode and serial only",
    template: MINIMAL_BARCODE_PRESET,
  },
  {
    id: "wide-retail",
    name: "Wide retail",
    description: "100×50 mm shelf label with brand, barcode, and serial",
    template: WIDE_RETAIL_PRESET,
  },
  {
    id: "blank-grid",
    name: "Blank grid",
    description: "Empty 2×2 grid — add your own elements in step 3",
    template: BLANK_GRID_PRESET,
  },
];

export function getBuiltInPreset(id: string): LabelTemplatePreset | undefined {
  return BUILT_IN_LABEL_PRESETS.find((p) => p.id === id);
}

export function getReferencePreset(): LabelTemplate {
  return structuredClone(KNOT_REFERENCE_PRESET);
}

export const BIN_REFERENCE_PRESET_ID = "bin-code-qr";

export const BIN_CODE_QR_PRESET: LabelTemplate = {
  version: 1,
  layoutMode: "grid",
  page: { widthMm: 58, heightMm: 40, marginMm: 2 },
  outerStyle: { color: "#1e293b", widthMm: 0.4, radiusMm: 1 },
  innerFrame: { color: "#cbd5e1", widthMm: 0.2 },
  grid: {
    rows: [
      { id: "bin-row-top", weight: 1 },
      { id: "bin-row-bottom", weight: 1.2 },
    ],
    cols: [
      { id: "bin-col-main", weight: 1.6 },
      { id: "bin-col-qr", weight: 1 },
    ],
  },
  cells: [
    {
      id: "bin-code",
      row: 0,
      col: 0,
      rowSpan: 2,
      element: {
        type: "text",
        binding: { kind: "binCode" },
        style: {
          fontSizePt: 14,
          fontWeight: "extrabold",
          align: "center",
          color: "#000000",
        },
      },
      paddingMm: 1,
    },
    {
      id: "bin-qr",
      row: 0,
      col: 1,
      element: {
        type: "qrcode",
        binding: { kind: "template", value: "https://knot.in/bins/{{binCode}}" },
        style: {
          errorCorrection: "M",
          foreground: "#000000",
          background: "#ffffff",
          quietZoneMm: 0.5,
          moduleScale: 1,
        },
      },
      paddingMm: 0.5,
    },
    {
      id: "bin-warehouse",
      row: 1,
      col: 1,
      element: {
        type: "text",
        binding: { kind: "warehouseName" },
        style: {
          fontSizePt: 7,
          fontWeight: "normal",
          align: "center",
          color: "#555555",
        },
      },
      paddingMm: 0.25,
    },
  ],
};

export const BIN_BLANK_GRID_PRESET: LabelTemplate = {
  version: 1,
  layoutMode: "grid",
  page: { widthMm: 58, heightMm: 40, marginMm: 2 },
  outerStyle: { color: "#94a3b8", widthMm: 0.4, radiusMm: 1 },
  innerFrame: { color: "#cbd5e1", widthMm: 0.15 },
  grid: {
    rows: [
      { id: "b-row-top", weight: 1 },
      { id: "b-row-bottom", weight: 1 },
    ],
    cols: [
      { id: "b-col-left", weight: 1 },
      { id: "b-col-right", weight: 1 },
    ],
  },
  cells: [],
};

export const BIN_BUILT_IN_PRESETS: LabelTemplatePreset[] = [
  {
    id: BIN_REFERENCE_PRESET_ID,
    name: "Bin code + QR",
    description: "Large bin code with QR and warehouse name",
    template: BIN_CODE_QR_PRESET,
  },
  {
    id: "bin-blank-grid",
    name: "Blank bin grid",
    description: "Empty 2×2 grid for custom bin layouts",
    template: BIN_BLANK_GRID_PRESET,
  },
];

export function getBinReferencePreset(): LabelTemplate {
  return structuredClone(BIN_CODE_QR_PRESET);
}

export function getBuiltInPresetsForPurpose(purpose: "serial" | "bin"): LabelTemplatePreset[] {
  return purpose === "bin" ? BIN_BUILT_IN_PRESETS : BUILT_IN_LABEL_PRESETS;
}
