import type { LabelTemplate } from "@/lib/label-template-types";
import type { ResolvedLabelTemplateSource } from "@/lib/label-template-types";
import { LABEL_STUDIO_WIZARD_STEPS } from "@/lib/label-studio-url";

export const WIZARD_STEP_TITLES = [
  "Start from",
  "Label size",
  "Place content",
  "Connect data",
  "Review & save",
] as const;

export type WizardValidationResult = {
  valid: boolean;
  message?: string;
};

export function validateWizardStep(step: number, template: LabelTemplate): WizardValidationResult {
  const clamped = Math.min(LABEL_STUDIO_WIZARD_STEPS, Math.max(1, step));

  switch (clamped) {
    case 1:
      return { valid: true };
    case 2:
      if (template.page.widthMm < 20 || template.page.heightMm < 15) {
        return { valid: false, message: "Choose a valid label size." };
      }
      return { valid: true };
    case 3: {
      const hasContent =
        template.layoutMode === "grid"
          ? (template.cells?.some((c) => c.element.type !== "spacer") ?? false)
          : (template.elements?.length ?? 0) > 0;
      if (!hasContent) {
        return { valid: false, message: "Add at least one element to the label." };
      }
      return { valid: true };
    }
    case 4:
    case 5:
      return { valid: true };
    default:
      return { valid: true };
  }
}

export function resolvedSourceLabel(source: ResolvedLabelTemplateSource): string {
  switch (source) {
    case "print_override":
      return "Print override";
    case "series":
      return "Series default";
    case "org_default":
      return "Organization default (serial)";
    case "reference_preset":
      return "Built-in preset";
    case "org_bin_default":
      return "Organization default (bin)";
    case "bin_reference_preset":
      return "Built-in bin preset";
  }
}
