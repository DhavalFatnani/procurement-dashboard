"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  getLabelTemplateById,
  getResolvedBinLabelTemplate,
  getResolvedLabelTemplateForPrint,
} from "@/app/actions/label-templates";
import { LabelSaveMenu } from "@/components/label-studio/LabelSaveMenu";
import { LabelStudioAdvanced } from "@/components/label-studio/LabelStudioAdvanced";
import { LabelStudioHub } from "@/components/label-studio/LabelStudioHub";
import { LabelTemplateLibrary } from "@/components/label-studio/LabelTemplateLibrary";
import { LabelWizard } from "@/components/label-studio/LabelWizard";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  loadLabelStudioDraft,
  markLabelStudioCustomized,
  saveLabelStudioDraft,
  type LabelStudioDraftScope,
} from "@/lib/label-studio-draft";
import { getBinReferencePreset, getReferencePreset } from "@/lib/label-template-presets";
import type {
  LabelBindingContext,
  LabelTemplate,
  LabelTemplatePurpose,
  ResolvedLabelTemplate,
} from "@/lib/label-template-types";
import { defaultLabelBindingContext, normalizeLabelTemplate } from "@/lib/label-template-types";
import {
  buildLabelStudioUrl,
  clampWizardStep,
  isEditorParams,
  parseLabelStudioSearchParams,
  type LabelStudioMode,
} from "@/lib/label-studio-url";
import { cn } from "@/lib/utils";
import { ArrowLeft, Sparkles, Wand2 } from "lucide-react";

export function LabelStudioPage({
  isAdmin,
  canManageSeries,
}: {
  isAdmin: boolean;
  canManageSeries: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParams = React.useMemo(
    () => parseLabelStudioSearchParams(searchParams),
    [searchParams],
  );

  const purpose: LabelTemplatePurpose = urlParams.purpose ?? "serial";
  const view = urlParams.view ?? "hub";
  const series = urlParams.series;
  const templateId = urlParams.templateId;
  const returnTo = urlParams.returnTo ?? "/purchase-requests/new?printOpen=1";
  const inEditor = isEditorParams(urlParams);

  const [mode, setMode] = React.useState<LabelStudioMode>(urlParams.mode ?? "wizard");
  const [step, setStep] = React.useState(() => clampWizardStep(urlParams.step));
  const [template, setTemplate] = React.useState<LabelTemplate>(() =>
    purpose === "bin" ? getBinReferencePreset() : getReferencePreset(),
  );
  const [templateName, setTemplateName] = React.useState<string>("");
  const [resolved, setResolved] = React.useState<ResolvedLabelTemplate | undefined>();
  const [dirty, setDirty] = React.useState(false);
  const [loading, setLoading] = React.useState(inEditor);

  const draftScope: LabelStudioDraftScope | null = series
    ? { kind: "series", series, purpose: "serial" }
    : templateId
      ? { kind: "template", templateId, purpose }
      : null;

  const context: LabelBindingContext = React.useMemo(() => {
    const base = defaultLabelBindingContext(purpose);
    if (purpose === "serial") {
      return {
        ...base,
        serial: base.serial,
        seriesName: series ?? base.seriesName,
        prId: urlParams.prId,
        prNumber: urlParams.prId,
        reservationId: urlParams.reservationId,
      };
    }
    return base;
  }, [purpose, series, urlParams.prId, urlParams.reservationId]);

  React.useEffect(() => {
    if (!inEditor) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadEditor() {
      if (series) {
        const draft = loadLabelStudioDraft({ kind: "series", series });
        const resolvedTemplate = await getResolvedLabelTemplateForPrint(
          series,
          urlParams.reservationId,
        );
        if (cancelled) return;
        setResolved(resolvedTemplate);
        if (draft?.customized) {
          setTemplate(normalizeLabelTemplate(draft.template));
        } else {
          setTemplate(normalizeLabelTemplate(resolvedTemplate.template));
        }
        setLoading(false);
        return;
      }

      if (templateId) {
        const draft = loadLabelStudioDraft({ kind: "template", templateId, purpose });
        const [record, binResolved] = await Promise.all([
          getLabelTemplateById(templateId),
          purpose === "bin" ? getResolvedBinLabelTemplate() : Promise.resolve(undefined),
        ]);
        if (cancelled) return;
        if (purpose === "bin" && binResolved) {
          setResolved(binResolved);
        }
        if (!record) {
          setLoading(false);
          return;
        }
        setTemplateName(record.name);
        if (draft?.customized) {
          setTemplate(normalizeLabelTemplate(draft.template));
        } else {
          setTemplate(normalizeLabelTemplate(record.template));
        }
        setLoading(false);
      }
    }

    void loadEditor();

    return () => {
      cancelled = true;
    };
  }, [inEditor, series, templateId, purpose, urlParams.reservationId]);

  function updateTemplate(next: LabelTemplate) {
    const normalized = normalizeLabelTemplate(next);
    setTemplate(normalized);
    setDirty(true);
    if (draftScope) {
      saveLabelStudioDraft({
        scope: draftScope,
        template: normalized,
        returnTo,
        customized: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  function handleDone() {
    if (draftScope) {
      markLabelStudioCustomized(draftScope, template, returnTo);
    }
    if (series) {
      router.push(returnTo);
    } else if (templateId) {
      router.push(buildLabelStudioUrl({ view: "library", purpose }));
    } else {
      router.push(buildLabelStudioUrl({ view: "hub" }));
    }
  }

  function switchMode(next: LabelStudioMode) {
    setMode(next);
    const url = buildLabelStudioUrl({
      view: "editor",
      purpose,
      series,
      templateId,
      returnTo,
      mode: next,
      step,
      reservationId: urlParams.reservationId,
      prId: urlParams.prId,
    });
    router.replace(url);
  }

  if (view === "hub" && !purpose && !series && !templateId) {
    return <LabelStudioHub />;
  }

  if (view === "library" && purpose && !inEditor) {
    return <LabelTemplateLibrary purpose={purpose} canManage={canManageSeries} />;
  }

  if (!inEditor) {
    return <LabelStudioHub />;
  }

  const backHref = series
    ? returnTo
    : buildLabelStudioUrl({ view: "library", purpose });

  const editorTitle = series
    ? `Design labels for ${series}`
    : templateName
      ? `Edit: ${templateName}`
      : purpose === "bin"
        ? "Design bin labels"
        : "Design serial labels";

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-ds-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Link>
            {dirty ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-ds-2xs font-medium text-amber-800 dark:text-amber-200">
                Unsaved changes
              </span>
            ) : null}
          </div>
          <PageHeader title="Label Studio" subtitle={editorTitle} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border-subtle p-0.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "wizard" ? "default" : "ghost"}
              className="h-8"
              onClick={() => switchMode("wizard")}
            >
              <Wand2 className="size-3.5" aria-hidden />
              Wizard
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "studio" ? "default" : "ghost"}
              className="h-8"
              onClick={() => switchMode("studio")}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Advanced
            </Button>
          </div>
          <LabelSaveMenu
            template={template}
            purpose={purpose}
            templateId={templateId}
            seriesCode={series}
            reservationId={urlParams.reservationId}
            resolved={resolved}
            draftScope={draftScope}
            isAdmin={isAdmin}
            canManageSeries={canManageSeries}
            onSaved={() => setDirty(false)}
          />
          <Button type="button" onClick={handleDone}>
            Done
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-ds-sm text-muted-foreground">Loading template…</p>
      ) : (
        <div className={cn("flex min-h-0 flex-1 flex-col rounded-xl border border-border-subtle bg-card")}>
          {mode === "wizard" ? (
            <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
              <LabelWizard
                step={step}
                template={template}
                onChange={updateTemplate}
                onStepChange={setStep}
                context={context}
                purpose={purpose}
                onSwitchToStudio={() => switchMode("studio")}
              />
            </div>
          ) : (
            <>
              <div className="border-b border-border-subtle px-4 py-2 text-ds-xs text-muted-foreground lg:hidden">
                Advanced studio works best on desktop. Wizard mode is available on mobile.
              </div>
              <LabelStudioAdvanced
                template={template}
                onChange={updateTemplate}
                context={context}
                purpose={purpose}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
