/** Label template v1 schema — grid builder + free-form placement. */

export const DEFAULT_LABEL_TEXT_COLOR = "#000000";

export type LabelTemplatePurpose = "serial" | "bin";

export type LabelTemplateVersion = 1;

export type LayoutMode = "grid" | "freeform";

export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export type FieldBinding =
  | { kind: "serial" }
  | { kind: "seriesName" }
  | { kind: "prId" }
  | { kind: "prNumber" }
  | { kind: "reservationId" }
  | { kind: "binCode" }
  | { kind: "warehouseName" }
  | { kind: "zone" }
  | { kind: "aisle" }
  | { kind: "shelf" }
  | { kind: "static"; value: string }
  | { kind: "template"; value: string };

export type BorderStyle = {
  color: string;
  widthMm: number;
  radiusMm?: number;
};

export type TextStyle = {
  fontSizePt: number;
  fontWeight: "normal" | "bold" | "extrabold";
  align: "left" | "center" | "right";
  color?: string;
  letterSpacingEm?: number;
  uppercase?: boolean;
};

export type Barcode1dStyle = {
  format: "CODE128";
  heightPx: number;
  moduleWidth: number;
  showValue: boolean;
  valueFontSizePt?: number;
};

export type QrStyle = {
  errorCorrection: QrErrorCorrection;
  foreground: string;
  background: string;
  quietZoneMm: number;
  moduleScale: number;
  logoUrl?: string;
};

export type LabelElement =
  | { type: "text"; binding: FieldBinding; style: TextStyle }
  | { type: "barcode1d"; format: "CODE128"; binding: FieldBinding; style: Barcode1dStyle }
  | { type: "qrcode"; binding: FieldBinding; style: QrStyle }
  | { type: "spacer" };

export type GridTrack = {
  id: string;
  weight: number;
};

export type GridCell = {
  id: string;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  element: LabelElement;
  paddingMm?: number;
};

export type PositionedElement = {
  id: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  zIndex: number;
  element: LabelElement;
};

export type LabelPage = {
  widthMm: number;
  heightMm: number;
  marginMm: number;
};

export type LabelTemplate = {
  version: LabelTemplateVersion;
  layoutMode: LayoutMode;
  page: LabelPage;
  outerStyle: BorderStyle;
  innerFrame?: BorderStyle;
  grid?: { rows: GridTrack[]; cols: GridTrack[] };
  cells?: GridCell[];
  elements?: PositionedElement[];
};

export type LabelBindingContext = {
  serial: string;
  seriesName: string;
  prId?: string;
  prNumber?: string;
  reservationId?: string;
  binCode?: string;
  warehouseName?: string;
  zone?: string;
  aisle?: string;
  shelf?: string;
};

export type ResolvedLabelTemplateSource =
  | "print_override"
  | "series"
  | "org_default"
  | "reference_preset"
  | "org_bin_default"
  | "bin_reference_preset";

export type ResolvedLabelTemplate = {
  template: LabelTemplate;
  source: ResolvedLabelTemplateSource;
  templateId?: string;
  purpose?: LabelTemplatePurpose;
};

export type LabelTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  purpose: LabelTemplatePurpose;
  isOrgDefault: boolean;
  updatedAt: string;
};

export const LABEL_PAGE_WIDTH_MM_MIN = 20;
export const LABEL_PAGE_WIDTH_MM_MAX = 300;
export const LABEL_PAGE_HEIGHT_MM_MIN = 15;
export const LABEL_PAGE_HEIGHT_MM_MAX = 300;
export const LABEL_MARGIN_MM_MIN = 0;
export const LABEL_MARGIN_MM_MAX = 15;
export const LABEL_TRACK_WEIGHT_MIN = 0.25;
export const LABEL_TRACK_WEIGHT_MAX = 10;

const FIELD_BINDING_KINDS = new Set([
  "serial",
  "seriesName",
  "prId",
  "prNumber",
  "reservationId",
  "binCode",
  "warehouseName",
  "zone",
  "aisle",
  "shelf",
  "static",
  "template",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseFieldBinding(raw: unknown): FieldBinding | null {
  if (!isObject(raw) || typeof raw.kind !== "string") {
    return null;
  }
  if (!FIELD_BINDING_KINDS.has(raw.kind)) {
    return null;
  }
  if (raw.kind === "static" || raw.kind === "template") {
    if (typeof raw.value !== "string") {
      return null;
    }
    return { kind: raw.kind, value: raw.value };
  }
  return { kind: raw.kind as Exclude<FieldBinding["kind"], "static" | "template"> };
}

function parseTextStyle(raw: unknown): TextStyle | null {
  if (!isObject(raw)) return null;
  const fontSizePt = typeof raw.fontSizePt === "number" ? raw.fontSizePt : 10;
  const fontWeight =
    raw.fontWeight === "bold" || raw.fontWeight === "extrabold" ? raw.fontWeight : "normal";
  const align =
    raw.align === "left" || raw.align === "right" ? raw.align : "center";
  return {
    fontSizePt: clampNumber(fontSizePt, 4, 72),
    fontWeight,
    align,
    color:
      typeof raw.color === "string" && raw.color.trim().length > 0
        ? raw.color
        : DEFAULT_LABEL_TEXT_COLOR,
    letterSpacingEm:
      typeof raw.letterSpacingEm === "number" ? clampNumber(raw.letterSpacingEm, 0, 1) : undefined,
    uppercase: raw.uppercase === true,
  };
}

function parseBarcodeStyle(raw: unknown): Barcode1dStyle | null {
  if (!isObject(raw)) return null;
  return {
    format: "CODE128",
    heightPx: clampNumber(typeof raw.heightPx === "number" ? raw.heightPx : 36, 12, 120),
    moduleWidth: clampNumber(typeof raw.moduleWidth === "number" ? raw.moduleWidth : 1.4, 0.5, 4),
    showValue: raw.showValue === true,
    valueFontSizePt:
      typeof raw.valueFontSizePt === "number"
        ? clampNumber(raw.valueFontSizePt, 4, 36)
        : undefined,
  };
}

function parseQrStyle(raw: unknown): QrStyle | null {
  if (!isObject(raw)) return null;
  const ec = raw.errorCorrection;
  const errorCorrection: QrErrorCorrection =
    ec === "L" || ec === "M" || ec === "Q" || ec === "H" ? ec : "M";
  return {
    errorCorrection,
    foreground: typeof raw.foreground === "string" ? raw.foreground : "#000000",
    background: typeof raw.background === "string" ? raw.background : "#ffffff",
    quietZoneMm: clampNumber(typeof raw.quietZoneMm === "number" ? raw.quietZoneMm : 1, 0, 5),
    moduleScale: clampNumber(typeof raw.moduleScale === "number" ? raw.moduleScale : 1, 0.5, 4),
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : undefined,
  };
}

function parseLabelElement(raw: unknown): LabelElement | null {
  if (!isObject(raw) || typeof raw.type !== "string") {
    return null;
  }
  if (raw.type === "spacer") {
    return { type: "spacer" };
  }
  if (raw.type === "text") {
    const binding = parseFieldBinding(raw.binding);
    const style = parseTextStyle(raw.style);
    if (!binding || !style) return null;
    return { type: "text", binding, style };
  }
  if (raw.type === "barcode1d") {
    const binding = parseFieldBinding(raw.binding);
    const style = parseBarcodeStyle(raw.style);
    if (!binding || !style) return null;
    return { type: "barcode1d", format: "CODE128", binding, style };
  }
  if (raw.type === "qrcode") {
    const binding = parseFieldBinding(raw.binding);
    const style = parseQrStyle(raw.style);
    if (!binding || !style) return null;
    return { type: "qrcode", binding, style };
  }
  return null;
}

function parseBorderStyle(raw: unknown): BorderStyle | null {
  if (!isObject(raw)) return null;
  return {
    color: typeof raw.color === "string" ? raw.color : "#000000",
    widthMm: clampNumber(typeof raw.widthMm === "number" ? raw.widthMm : 0.3, 0, 3),
    radiusMm:
      typeof raw.radiusMm === "number" ? clampNumber(raw.radiusMm, 0, 10) : undefined,
  };
}

function parseGridTrack(raw: unknown): GridTrack | null {
  if (!isObject(raw) || typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    weight: clampNumber(
      typeof raw.weight === "number" ? raw.weight : 1,
      LABEL_TRACK_WEIGHT_MIN,
      LABEL_TRACK_WEIGHT_MAX,
    ),
  };
}

function parseGridCell(raw: unknown): GridCell | null {
  if (!isObject(raw) || typeof raw.id !== "string") return null;
  const element = parseLabelElement(raw.element);
  if (!element) return null;
  if (typeof raw.row !== "number" || typeof raw.col !== "number") return null;
  return {
    id: raw.id,
    row: Math.max(0, Math.floor(raw.row)),
    col: Math.max(0, Math.floor(raw.col)),
    rowSpan: typeof raw.rowSpan === "number" ? Math.max(1, Math.floor(raw.rowSpan)) : undefined,
    colSpan: typeof raw.colSpan === "number" ? Math.max(1, Math.floor(raw.colSpan)) : undefined,
    element,
    paddingMm:
      typeof raw.paddingMm === "number" ? clampNumber(raw.paddingMm, 0, 5) : undefined,
  };
}

function parsePositionedElement(raw: unknown): PositionedElement | null {
  if (!isObject(raw) || typeof raw.id !== "string") return null;
  const element = parseLabelElement(raw.element);
  if (!element) return null;
  return {
    id: raw.id,
    xMm: typeof raw.xMm === "number" ? raw.xMm : 0,
    yMm: typeof raw.yMm === "number" ? raw.yMm : 0,
    widthMm: clampNumber(typeof raw.widthMm === "number" ? raw.widthMm : 10, 1, 300),
    heightMm: clampNumber(typeof raw.heightMm === "number" ? raw.heightMm : 10, 1, 300),
    zIndex: typeof raw.zIndex === "number" ? Math.floor(raw.zIndex) : 0,
    element,
  };
}

/** Parse and normalize a LabelTemplate from unknown JSON. */
export function parseLabelTemplate(raw: unknown): LabelTemplate | null {
  if (!isObject(raw)) return null;
  if (raw.version !== 1) return null;

  const layoutMode = raw.layoutMode === "freeform" ? "freeform" : "grid";
  if (!isObject(raw.page)) return null;

  const page: LabelPage = {
    widthMm: clampNumber(
      typeof raw.page.widthMm === "number" ? raw.page.widthMm : 58,
      LABEL_PAGE_WIDTH_MM_MIN,
      LABEL_PAGE_WIDTH_MM_MAX,
    ),
    heightMm: clampNumber(
      typeof raw.page.heightMm === "number" ? raw.page.heightMm : 40,
      LABEL_PAGE_HEIGHT_MM_MIN,
      LABEL_PAGE_HEIGHT_MM_MAX,
    ),
    marginMm: clampNumber(
      typeof raw.page.marginMm === "number" ? raw.page.marginMm : 2,
      LABEL_MARGIN_MM_MIN,
      LABEL_MARGIN_MM_MAX,
    ),
  };

  const outerStyle = parseBorderStyle(raw.outerStyle);
  if (!outerStyle) return null;

  const innerFrame = raw.innerFrame ? parseBorderStyle(raw.innerFrame) ?? undefined : undefined;

  const template: LabelTemplate = {
    version: 1,
    layoutMode,
    page,
    outerStyle,
    innerFrame,
  };

  if (layoutMode === "grid") {
    if (!isObject(raw.grid) || !Array.isArray(raw.grid.rows) || !Array.isArray(raw.grid.cols)) {
      return null;
    }
    const rows = raw.grid.rows.map(parseGridTrack).filter((t): t is GridTrack => t !== null);
    const cols = raw.grid.cols.map(parseGridTrack).filter((t): t is GridTrack => t !== null);
    if (rows.length === 0 || cols.length === 0) return null;
    const cells = Array.isArray(raw.cells)
      ? raw.cells.map(parseGridCell).filter((c): c is GridCell => c !== null)
      : [];
    template.grid = { rows, cols };
    template.cells = cells;
  } else {
    const elements = Array.isArray(raw.elements)
      ? raw.elements.map(parsePositionedElement).filter((e): e is PositionedElement => e !== null)
      : [];
    template.elements = elements;
  }

  return template;
}

export function normalizeLabelTemplate(template: LabelTemplate): LabelTemplate {
  const parsed = parseLabelTemplate(template);
  return parsed ?? template;
}

export function resolveFieldBinding(
  binding: FieldBinding,
  context: LabelBindingContext,
): string {
  switch (binding.kind) {
    case "serial":
      return context.serial;
    case "seriesName":
      return context.seriesName;
    case "prId":
      return context.prId ?? "";
    case "prNumber":
      return context.prNumber ?? context.prId ?? "";
    case "reservationId":
      return context.reservationId ?? "";
    case "binCode":
      return context.binCode ?? "";
    case "warehouseName":
      return context.warehouseName ?? "";
    case "zone":
      return context.zone ?? "";
    case "aisle":
      return context.aisle ?? "";
    case "shelf":
      return context.shelf ?? "";
    case "static":
      return binding.value;
    case "template":
      return binding.value
        .replace(/\{\{serial\}\}/g, context.serial)
        .replace(/\{\{seriesName\}\}/g, context.seriesName)
        .replace(/\{\{prId\}\}/g, context.prId ?? "")
        .replace(/\{\{prNumber\}\}/g, context.prNumber ?? context.prId ?? "")
        .replace(/\{\{reservationId\}\}/g, context.reservationId ?? "")
        .replace(/\{\{binCode\}\}/g, context.binCode ?? "")
        .replace(/\{\{warehouseName\}\}/g, context.warehouseName ?? "")
        .replace(/\{\{zone\}\}/g, context.zone ?? "")
        .replace(/\{\{aisle\}\}/g, context.aisle ?? "")
        .replace(/\{\{shelf\}\}/g, context.shelf ?? "");
    default:
      return "";
  }
}

export function resolveLabelBindings(
  template: LabelTemplate,
  context: LabelBindingContext,
): Map<string, string> {
  const bindings = new Map<string, string>();

  const addElement = (id: string, element: LabelElement) => {
    if (element.type === "spacer") return;
    bindings.set(id, resolveFieldBinding(element.binding, context));
  };

  if (template.layoutMode === "grid" && template.cells) {
    for (const cell of template.cells) {
      addElement(cell.id, cell.element);
    }
  } else if (template.elements) {
    for (const positioned of template.elements) {
      addElement(positioned.id, positioned.element);
    }
  }

  return bindings;
}

export const SERIAL_FIELD_BINDING_OPTIONS: { kind: FieldBinding["kind"]; label: string }[] = [
  { kind: "serial", label: "Serial number" },
  { kind: "seriesName", label: "Series name" },
  { kind: "prId", label: "PR ID" },
  { kind: "prNumber", label: "PR number" },
  { kind: "reservationId", label: "Reservation ID" },
  { kind: "static", label: "Static text" },
  { kind: "template", label: "URL template" },
];

export const BIN_FIELD_BINDING_OPTIONS: { kind: FieldBinding["kind"]; label: string }[] = [
  { kind: "binCode", label: "Bin code" },
  { kind: "warehouseName", label: "Warehouse name" },
  { kind: "zone", label: "Zone" },
  { kind: "aisle", label: "Aisle" },
  { kind: "shelf", label: "Shelf" },
  { kind: "static", label: "Static text" },
  { kind: "template", label: "URL template" },
];

export const FIELD_BINDING_OPTIONS = SERIAL_FIELD_BINDING_OPTIONS;

export function fieldBindingOptionsForPurpose(
  purpose: LabelTemplatePurpose,
): { kind: FieldBinding["kind"]; label: string }[] {
  return purpose === "bin" ? BIN_FIELD_BINDING_OPTIONS : SERIAL_FIELD_BINDING_OPTIONS;
}

export function defaultLabelBindingContext(
  purpose: LabelTemplatePurpose,
): LabelBindingContext {
  if (purpose === "bin") {
    return {
      serial: "",
      seriesName: "",
      binCode: "A-12-03",
      warehouseName: "WH1 · Andheri",
      zone: "Zone A",
      aisle: "12",
      shelf: "03",
    };
  }
  return {
    serial: "2000000000",
    seriesName: "Lock Tags",
  };
}

export function createDefaultFieldBinding(
  kind: FieldBinding["kind"],
  purpose: LabelTemplatePurpose = "serial",
): FieldBinding {
  if (kind === "static") return { kind: "static", value: "Text" };
  if (kind === "template") {
    return purpose === "bin"
      ? { kind: "template", value: "https://knot.in/bins/{{binCode}}" }
      : { kind: "template", value: "https://knot.in/t/{{serial}}" };
  }
  return { kind };
}

export function prismaPurposeToApp(purpose: "SERIAL" | "BIN"): LabelTemplatePurpose {
  return purpose === "BIN" ? "bin" : "serial";
}

export function appPurposeToPrisma(purpose: LabelTemplatePurpose): "SERIAL" | "BIN" {
  return purpose === "bin" ? "BIN" : "SERIAL";
}
