import type {
  LabelTemplate,
  LabelTemplatePurpose,
  ResolvedLabelTemplate,
} from "@/lib/label-template-types";
import { parseLabelTemplate } from "@/lib/label-template-types";
import { getBinReferencePreset, getReferencePreset } from "@/lib/label-template-presets";

export type LabelTemplateResolveInput = {
  purpose?: LabelTemplatePurpose;
  printTimeOverride?: unknown;
  seriesTemplate?: unknown;
  orgDefaultTemplate?: unknown;
  orgBinDefaultTemplate?: unknown;
};

/** Serial: print-time → series → org default → reference preset. Bin: org bin default → bin reference preset. */
export function resolveLabelTemplateChain(
  input: LabelTemplateResolveInput,
): ResolvedLabelTemplate {
  const purpose = input.purpose ?? "serial";

  if (purpose === "bin") {
    const orgBinDefault = input.orgBinDefaultTemplate
      ? parseLabelTemplate(input.orgBinDefaultTemplate)
      : null;
    if (orgBinDefault) {
      return { template: orgBinDefault, source: "org_bin_default", purpose: "bin" };
    }
    return {
      template: getBinReferencePreset(),
      source: "bin_reference_preset",
      purpose: "bin",
    };
  }

  const printOverride = input.printTimeOverride
    ? parseLabelTemplate(input.printTimeOverride)
    : null;
  if (printOverride) {
    return { template: printOverride, source: "print_override", purpose: "serial" };
  }

  const seriesTemplate = input.seriesTemplate
    ? parseLabelTemplate(input.seriesTemplate)
    : null;
  if (seriesTemplate) {
    return { template: seriesTemplate, source: "series", purpose: "serial" };
  }

  const orgDefault = input.orgDefaultTemplate
    ? parseLabelTemplate(input.orgDefaultTemplate)
    : null;
  if (orgDefault) {
    return { template: orgDefault, source: "org_default", purpose: "serial" };
  }

  return {
    template: getReferencePreset(),
    source: "reference_preset",
    purpose: "serial",
  };
}

export function resolveLabelTemplateWithIds(
  input: LabelTemplateResolveInput & {
    seriesTemplateId?: string;
    orgDefaultTemplateId?: string;
    orgBinDefaultTemplateId?: string;
  },
): ResolvedLabelTemplate {
  const resolved = resolveLabelTemplateChain(input);
  if (resolved.source === "series" && input.seriesTemplateId) {
    return { ...resolved, templateId: input.seriesTemplateId };
  }
  if (resolved.source === "org_default" && input.orgDefaultTemplateId) {
    return { ...resolved, templateId: input.orgDefaultTemplateId };
  }
  if (resolved.source === "org_bin_default" && input.orgBinDefaultTemplateId) {
    return { ...resolved, templateId: input.orgBinDefaultTemplateId };
  }
  return resolved;
}

export function templatesEqual(a: LabelTemplate, b: LabelTemplate): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
