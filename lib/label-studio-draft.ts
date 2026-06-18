import type { SeriesCode } from "@/lib/series-codes";
import type { LabelTemplate, LabelTemplatePurpose } from "@/lib/label-template-types";
import { normalizeLabelTemplate, parseLabelTemplate } from "@/lib/label-template-types";

const SESSION_PREFIX = "knot-label-studio-draft:";
const LOCAL_PREFIX = "knot-label-studio-local:";

export type LabelStudioDraftScope =
  | { kind: "series"; series: SeriesCode; purpose?: "serial" }
  | { kind: "template"; templateId: string; purpose: LabelTemplatePurpose };

export type LabelStudioDraft = {
  scope: LabelStudioDraftScope;
  template: LabelTemplate;
  returnTo?: string;
  customized: boolean;
  updatedAt: string;
};

function draftKey(scope: LabelStudioDraftScope): string {
  if (scope.kind === "series") {
    return `serial:${scope.series}`;
  }
  return `${scope.purpose}:${scope.templateId}`;
}

function sessionStorageKey(key: string): string {
  return `${SESSION_PREFIX}${key}`;
}

function localStorageKey(key: string): string {
  return `${LOCAL_PREFIX}${key}`;
}

function parseDraft(raw: string): LabelStudioDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LabelStudioDraft> & {
      series?: SeriesCode;
    };
    const template = parseLabelTemplate(parsed.template);
    if (!template) return null;

    if (parsed.scope?.kind === "template" && parsed.scope.templateId) {
      return {
        scope: {
          kind: "template",
          templateId: parsed.scope.templateId,
          purpose: parsed.scope.purpose === "bin" ? "bin" : "serial",
        },
        template,
        returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : undefined,
        customized: parsed.customized === true,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      };
    }

    const series = parsed.scope?.kind === "series" ? parsed.scope.series : parsed.series;
    if (!series) return null;

    return {
      scope: { kind: "series", series, purpose: "serial" },
      template,
      returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : undefined,
      customized: parsed.customized === true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveLabelStudioDraft(draft: LabelStudioDraft): void {
  const normalized: LabelStudioDraft = {
    ...draft,
    template: normalizeLabelTemplate(draft.template),
    updatedAt: new Date().toISOString(),
  };
  const key = draftKey(normalized.scope);
  const payload = JSON.stringify(normalized);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(sessionStorageKey(key), payload);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(localStorageKey(key), payload);
  }
}

export function loadLabelStudioDraft(scope: LabelStudioDraftScope): LabelStudioDraft | null {
  const key = draftKey(scope);
  if (typeof sessionStorage !== "undefined") {
    const sessionRaw = sessionStorage.getItem(sessionStorageKey(key));
    if (sessionRaw) {
      const draft = parseDraft(sessionRaw);
      if (draft) return draft;
    }
  }
  if (typeof localStorage !== "undefined") {
    const localRaw = localStorage.getItem(localStorageKey(key));
    if (localRaw) {
      return parseDraft(localRaw);
    }
  }
  return null;
}

export function clearLabelStudioDraft(scope: LabelStudioDraftScope): void {
  const key = draftKey(scope);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(sessionStorageKey(key));
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(localStorageKey(key));
  }
}

export function markLabelStudioCustomized(
  scope: LabelStudioDraftScope,
  template: LabelTemplate,
  returnTo?: string,
): LabelStudioDraft {
  const existing = loadLabelStudioDraft(scope);
  const draft: LabelStudioDraft = {
    scope,
    template: normalizeLabelTemplate(template),
    returnTo: returnTo ?? existing?.returnTo,
    customized: true,
    updatedAt: new Date().toISOString(),
  };
  saveLabelStudioDraft(draft);
  return draft;
}
