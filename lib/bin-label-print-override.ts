import type { LabelTemplate } from "@/lib/label-template-types";
import { normalizeLabelTemplate, parseLabelTemplate } from "@/lib/label-template-types";

const SESSION_KEY = "knot-bin-print-template-override";

export function saveBinPrintTemplateOverride(template: LabelTemplate): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify(normalizeLabelTemplate(template)),
  );
}

export function loadBinPrintTemplateOverride(): LabelTemplate | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return parseLabelTemplate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearBinPrintTemplateOverride(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}
