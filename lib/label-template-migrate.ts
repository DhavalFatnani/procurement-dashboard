import type { BarcodeLabelConfig } from "@/lib/barcode-label-config";
import { getBarcodePageSpec } from "@/lib/barcode-label-config";
import type { LabelTemplate } from "@/lib/label-template-types";
import { getReferencePreset } from "@/lib/label-template-presets";

/** Convert legacy BarcodeLabelConfig to an equivalent grid LabelTemplate. */
export function migrateBarcodeLabelConfigToTemplate(
  config: BarcodeLabelConfig,
): LabelTemplate {
  const pageSpec = getBarcodePageSpec(config.pageSize);
  const base = getReferencePreset();

  base.page = {
    widthMm: pageSpec.widthMm,
    heightMm: pageSpec.heightMm,
    marginMm: config.marginMm,
  };

  const brandCell = base.cells?.find((c) => c.id === "cell-brand");
  const barcodeCell = base.cells?.find((c) => c.id === "cell-barcode");
  const serialCell = base.cells?.find((c) => c.id === "cell-serial");

  if (brandCell?.element.type === "text") {
    const brandPt = resolveLegacyBrandPt(config);
    brandCell.element.style.fontSizePt = brandPt;
    brandCell.element.style.letterSpacingEm = 0.2 + config.typographyScale * 0.1;
  }

  if (barcodeCell?.element.type === "barcode1d") {
    barcodeCell.element.style.heightPx = config.barcodeHeight;
    barcodeCell.element.style.moduleWidth = config.barcodeModuleWidth;
    barcodeCell.element.style.showValue = false;
  }

  if (serialCell) {
    if (!config.showBarcodeValue) {
      serialCell.element = { type: "spacer" };
    } else if (serialCell.element.type === "text") {
      serialCell.element.style.fontSizePt = Math.round(8 * config.barcodeValueScale * 10) / 10;
    }
  }

  if (config.showSeriesName) {
    const seriesCell = {
      id: "cell-series-migrated",
      row: 1,
      col: 1,
      colSpan: 2,
      element: {
        type: "text" as const,
        binding: { kind: "seriesName" as const },
        style: {
          fontSizePt: Math.round(6 * config.seriesNameScale * 10) / 10,
          fontWeight: "normal" as const,
          align: "center" as const,
          color: "#444444",
        },
      },
      paddingMm: 0.5,
    };

    if (base.grid) {
      base.grid.rows = [
        { id: "row-top", weight: 1.4 },
        { id: "row-mid", weight: 0.8 },
        { id: "row-bottom", weight: 0.7 },
      ];
    }

    const existingSerial = base.cells?.find((c) => c.id === "cell-serial");
    if (existingSerial) {
      existingSerial.row = 2;
      existingSerial.col = 1;
    }

    base.cells = [...(base.cells ?? []).filter((c) => c.id !== "cell-series-migrated"), seriesCell];
    if (existingSerial && base.cells) {
      const idx = base.cells.findIndex((c) => c.id === "cell-serial");
      if (idx >= 0) {
        base.cells[idx] = existingSerial;
      }
    }
  }

  return base;
}

function resolveLegacyBrandPt(config: BarcodeLabelConfig): number {
  const brandBase: Record<BarcodeLabelConfig["brandSize"], number> = {
    medium: 8,
    large: 10,
    xlarge: 12,
    xxlarge: 14,
    display: 17,
  };
  const isLabel = getBarcodePageSpec(config.pageSize).group === "label";
  const sheetMultiplier = isLabel ? 1 : 2;
  return Math.round(brandBase[config.brandSize] * config.typographyScale * sheetMultiplier * 10) / 10;
}
