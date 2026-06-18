import type { SeriesCode } from "@/lib/series-codes";
import type { LabelTemplatePurpose } from "@/lib/label-template-types";

export type LabelStudioMode = "wizard" | "studio";

export type LabelStudioView = "hub" | "library" | "editor";

export type LabelStudioUrlParams = {
  view?: LabelStudioView;
  purpose?: LabelTemplatePurpose;
  templateId?: string;
  series?: SeriesCode;
  returnTo?: string;
  mode?: LabelStudioMode;
  step?: number;
  reservationId?: string;
  prId?: string;
};

export const LABEL_STUDIO_PATH = "/label-studio";

export const LABEL_STUDIO_WIZARD_STEPS = 5;

export function buildLabelStudioUrl(params: LabelStudioUrlParams): string {
  const search = new URLSearchParams();
  if (params.view) search.set("view", params.view);
  if (params.purpose) search.set("purpose", params.purpose);
  if (params.templateId) search.set("templateId", params.templateId);
  if (params.series) search.set("series", params.series);
  if (params.returnTo) search.set("returnTo", params.returnTo);
  if (params.mode) search.set("mode", params.mode);
  if (params.step != null && params.step >= 1) {
    search.set("step", String(params.step));
  }
  if (params.reservationId) search.set("reservationId", params.reservationId);
  if (params.prId) search.set("prId", params.prId);
  const query = search.toString();
  return query ? `${LABEL_STUDIO_PATH}?${query}` : LABEL_STUDIO_PATH;
}

export function parseLabelStudioSearchParams(
  searchParams: URLSearchParams,
): LabelStudioUrlParams {
  const viewRaw = searchParams.get("view");
  const view: LabelStudioView | undefined =
    viewRaw === "library" || viewRaw === "editor" || viewRaw === "hub"
      ? viewRaw
      : undefined;

  const purposeRaw = searchParams.get("purpose");
  const purpose: LabelTemplatePurpose | undefined =
    purposeRaw === "bin" || purposeRaw === "serial" ? purposeRaw : undefined;

  const series = searchParams.get("series") as SeriesCode | null;

  const modeRaw = searchParams.get("mode");
  const mode: LabelStudioMode | undefined =
    modeRaw === "studio" ? "studio" : modeRaw === "wizard" ? "wizard" : undefined;

  const stepRaw = searchParams.get("step");
  const step = stepRaw ? Number.parseInt(stepRaw, 10) : undefined;

  const templateId = searchParams.get("templateId") ?? undefined;

  const hasEditorContext = Boolean(series || templateId || view === "editor");

  return {
    view: view ?? (hasEditorContext ? "editor" : series || purpose ? "library" : "hub"),
    purpose: purpose ?? (series ? "serial" : undefined),
    templateId,
    series: series ?? undefined,
    returnTo: searchParams.get("returnTo") ?? undefined,
    mode,
    step: step && Number.isFinite(step) ? step : undefined,
    reservationId: searchParams.get("reservationId") ?? undefined,
    prId: searchParams.get("prId") ?? undefined,
  };
}

export function clampWizardStep(step: number | undefined): number {
  if (!step || !Number.isFinite(step)) return 1;
  return Math.min(LABEL_STUDIO_WIZARD_STEPS, Math.max(1, Math.floor(step)));
}

export function isEditorParams(params: LabelStudioUrlParams): boolean {
  return params.view === "editor" && Boolean(params.series || params.templateId);
}
