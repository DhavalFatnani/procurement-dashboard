import { describe, expect, it } from "vitest";

import { DEFAULT_BARCODE_LABEL_CONFIG } from "@/lib/barcode-label-config";
import { migrateBarcodeLabelConfigToTemplate } from "@/lib/label-template-migrate";
import { KNOT_REFERENCE_PRESET } from "@/lib/label-template-presets";

describe("label-template-migrate", () => {
  it("migrates default config to grid template", () => {
    const template = migrateBarcodeLabelConfigToTemplate(DEFAULT_BARCODE_LABEL_CONFIG);
    expect(template.layoutMode).toBe("grid");
    expect(template.page.widthMm).toBeGreaterThan(0);
    expect(template.cells?.some((c) => c.element.type === "barcode1d")).toBe(true);
  });

  it("preserves page size from legacy config", () => {
    const template = migrateBarcodeLabelConfigToTemplate({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      pageSize: "label-80x50",
    });
    expect(template.page.widthMm).toBe(80);
    expect(template.page.heightMm).toBe(50);
  });

  it("hides serial when showBarcodeValue is false", () => {
    const template = migrateBarcodeLabelConfigToTemplate({
      ...DEFAULT_BARCODE_LABEL_CONFIG,
      showBarcodeValue: false,
    });
    const serialCell = template.cells?.find((c) => c.id === "cell-serial");
    expect(serialCell?.element.type).toBe("spacer");
  });

  it("starts from reference preset structure", () => {
    const template = migrateBarcodeLabelConfigToTemplate(DEFAULT_BARCODE_LABEL_CONFIG);
    expect(template.outerStyle.color).toBe(KNOT_REFERENCE_PRESET.outerStyle.color);
  });
});
