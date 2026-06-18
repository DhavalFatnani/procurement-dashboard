import { describe, expect, it } from "vitest";

import { getBinReferencePreset, getReferencePreset } from "@/lib/label-template-presets";
import { resolveLabelTemplateChain } from "@/lib/label-template-resolve";

describe("label-template-resolve", () => {
  const reference = getReferencePreset();
  const binReference = getBinReferencePreset();
  const orgTemplate = { ...reference, page: { ...reference.page, marginMm: 5 } };
  const seriesTemplate = { ...reference, page: { ...reference.page, marginMm: 3 } };
  const printTemplate = { ...reference, page: { ...reference.page, marginMm: 1 } };
  const orgBinTemplate = { ...binReference, page: { ...binReference.page, marginMm: 4 } };

  it("prefers print-time override for serial", () => {
    const resolved = resolveLabelTemplateChain({
      purpose: "serial",
      printTimeOverride: printTemplate,
      seriesTemplate,
      orgDefaultTemplate: orgTemplate,
    });
    expect(resolved.source).toBe("print_override");
    expect(resolved.template.page.marginMm).toBe(1);
  });

  it("falls back to series override", () => {
    const resolved = resolveLabelTemplateChain({
      purpose: "serial",
      seriesTemplate,
      orgDefaultTemplate: orgTemplate,
    });
    expect(resolved.source).toBe("series");
    expect(resolved.template.page.marginMm).toBe(3);
  });

  it("falls back to org default for serial", () => {
    const resolved = resolveLabelTemplateChain({
      purpose: "serial",
      orgDefaultTemplate: orgTemplate,
    });
    expect(resolved.source).toBe("org_default");
    expect(resolved.template.page.marginMm).toBe(5);
  });

  it("uses reference preset when nothing configured for serial", () => {
    const resolved = resolveLabelTemplateChain({ purpose: "serial" });
    expect(resolved.source).toBe("reference_preset");
    expect(resolved.template.page.widthMm).toBe(58);
  });

  it("resolves bin org default", () => {
    const resolved = resolveLabelTemplateChain({
      purpose: "bin",
      orgBinDefaultTemplate: orgBinTemplate,
    });
    expect(resolved.source).toBe("org_bin_default");
    expect(resolved.template.page.marginMm).toBe(4);
  });

  it("uses bin reference preset when no org bin default", () => {
    const resolved = resolveLabelTemplateChain({ purpose: "bin" });
    expect(resolved.source).toBe("bin_reference_preset");
    expect(resolved.template.cells?.some((c) => c.id === "bin-code")).toBe(true);
  });
});
