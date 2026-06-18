import type { GridCell, LabelElement, LabelTemplate, LabelTemplatePurpose, PositionedElement } from "@/lib/label-template-types";
import { DEFAULT_LABEL_TEXT_COLOR } from "@/lib/label-template-types";
import {
  BARCODE_PAGE_SIZE_GROUPS,
  BARCODE_PAGE_SIZE_OPTIONS,
  type BarcodePageSize,
} from "@/lib/barcode-label-config";

export function newStudioId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultLabelElement(
  type: LabelElement["type"],
  purpose: LabelTemplatePurpose = "serial",
): LabelElement {
  switch (type) {
    case "text":
      return {
        type: "text",
        binding: purpose === "bin" ? { kind: "binCode" } : { kind: "serial" },
        style: {
          fontSizePt: 10,
          fontWeight: "normal",
          align: "center",
          color: DEFAULT_LABEL_TEXT_COLOR,
        },
      };
    case "barcode1d":
      return {
        type: "barcode1d",
        format: "CODE128",
        binding: purpose === "bin" ? { kind: "binCode" } : { kind: "serial" },
        style: { format: "CODE128", heightPx: 32, moduleWidth: 1.3, showValue: false },
      };
    case "qrcode":
      return {
        type: "qrcode",
        binding:
          purpose === "bin"
            ? { kind: "template", value: "https://knot.in/bins/{{binCode}}" }
            : { kind: "template", value: "https://knot.in/t/{{serial}}" },
        style: {
          errorCorrection: "M",
          foreground: "#000000",
          background: "#ffffff",
          quietZoneMm: 0.5,
          moduleScale: 1,
        },
      };
    default:
      return { type: "spacer" };
  }
}

export function addGridCell(
  template: LabelTemplate,
  elementType: LabelElement["type"],
  at?: { row: number; col: number },
  purpose: LabelTemplatePurpose = "serial",
): LabelTemplate {
  const grid = template.grid;
  if (!grid) return template;
  const cells = template.cells ?? [];
  const cell: GridCell = {
    id: newStudioId("cell"),
    row: at?.row ?? 0,
    col: at?.col ?? Math.max(0, grid.cols.length - 1),
    element: defaultLabelElement(elementType, purpose),
    paddingMm: 0.5,
  };
  return { ...template, cells: [...cells, cell] };
}

export function addFreeformElement(
  template: LabelTemplate,
  elementType: LabelElement["type"],
  purpose: LabelTemplatePurpose = "serial",
): LabelTemplate {
  const elements = template.elements ?? [];
  const innerW = template.page.widthMm - template.page.marginMm * 2;
  const innerH = template.page.heightMm - template.page.marginMm * 2;
  const element: PositionedElement = {
    id: newStudioId("el"),
    xMm: template.page.marginMm + 2,
    yMm: template.page.marginMm + 2,
    widthMm: Math.min(innerW - 4, 24),
    heightMm: Math.min(innerH - 4, 12),
    zIndex: elements.length + 1,
    element: defaultLabelElement(elementType, purpose),
  };
  return { ...template, elements: [...elements, element] };
}

export function removeGridCell(template: LabelTemplate, cellId: string): LabelTemplate {
  if (!template.cells) return template;
  return { ...template, cells: template.cells.filter((c) => c.id !== cellId) };
}

export function removeFreeformElement(template: LabelTemplate, elementId: string): LabelTemplate {
  if (!template.elements) return template;
  return { ...template, elements: template.elements.filter((e) => e.id !== elementId) };
}

export type LabelSizeOption = {
  id: BarcodePageSize;
  label: string;
  hint: string;
  group: "sheet" | "label";
  widthMm: number;
  heightMm: number;
};

export const LABEL_SIZE_OPTIONS: LabelSizeOption[] = BARCODE_PAGE_SIZE_OPTIONS.map((opt) => ({
  id: opt.value,
  label: opt.label,
  hint: opt.hint,
  group: opt.group,
  widthMm: opt.widthMm,
  heightMm: opt.heightMm,
}));

export { BARCODE_PAGE_SIZE_GROUPS };

export function labelDimensionsMatch(
  page: { widthMm: number; heightMm: number },
  option: Pick<LabelSizeOption, "widthMm" | "heightMm">,
  toleranceMm = 0.6,
): boolean {
  return (
    Math.abs(page.widthMm - option.widthMm) <= toleranceMm &&
    Math.abs(page.heightMm - option.heightMm) <= toleranceMm
  );
}

export function formatGridCellLabel(cell: GridCell): string {
  const typeLabel =
    cell.element.type === "barcode1d"
      ? "Barcode"
      : cell.element.type === "qrcode"
        ? "QR code"
        : cell.element.type === "text"
          ? "Text"
          : "Spacer";
  return `${typeLabel} · row ${cell.row + 1}, col ${cell.col + 1}`;
}

/** @deprecated Use LABEL_SIZE_OPTIONS */
export const LABEL_SIZE_PRESETS = LABEL_SIZE_OPTIONS.filter((o) => o.group === "label").map(
  (o) => ({
    id: o.id,
    label: o.label,
    widthMm: o.widthMm,
    heightMm: o.heightMm,
  }),
);
