import { describe, expect, it, beforeEach } from "vitest";

import { getBinReferencePreset } from "@/lib/label-template-presets";
import { normalizeLabelTemplate } from "@/lib/label-template-types";
import {
  clearBinPrintTemplateOverride,
  loadBinPrintTemplateOverride,
  saveBinPrintTemplateOverride,
} from "@/lib/bin-label-print-override";

describe("bin-label-print-override", () => {
  beforeEach(() => {
    clearBinPrintTemplateOverride();
  });

  it("round-trips a template through session storage", () => {
    const template = getBinReferencePreset();
    saveBinPrintTemplateOverride(template);
    const loaded = loadBinPrintTemplateOverride();
    expect(loaded).toEqual(normalizeLabelTemplate(template));
  });

  it("returns null when nothing is saved", () => {
    expect(loadBinPrintTemplateOverride()).toBeNull();
  });
});
