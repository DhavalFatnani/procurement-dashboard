"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  createLabelTemplateRecord,
  saveOrgBinDefaultLabelTemplate,
  saveOrgDefaultLabelTemplate,
  savePrintTimeLabelOverride,
  saveSeriesLabelTemplate,
  updateLabelTemplateRecord,
} from "@/app/actions/label-templates";
import { saveBinPrintTemplateOverride } from "@/lib/bin-label-print-override";
import {
  clearLabelStudioDraft,
  markLabelStudioCustomized,
  type LabelStudioDraftScope,
} from "@/lib/label-studio-draft";
import type { LabelTemplate, LabelTemplatePurpose, ResolvedLabelTemplate } from "@/lib/label-template-types";
import { resolvedSourceLabel } from "@/lib/label-studio-wizard";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export function LabelSaveMenu({
  template,
  purpose = "serial",
  templateId,
  seriesCode,
  reservationId,
  resolved,
  draftScope,
  isAdmin,
  canManageSeries,
  disabled,
  onSaved,
}: {
  template: LabelTemplate;
  purpose?: LabelTemplatePurpose;
  templateId?: string;
  seriesCode?: string;
  reservationId?: string;
  resolved?: ResolvedLabelTemplate;
  draftScope?: LabelStudioDraftScope | null;
  isAdmin?: boolean;
  canManageSeries?: boolean;
  disabled?: boolean;
  onSaved?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  function finishSave(success: string) {
    if (draftScope) {
      clearLabelStudioDraft(draftScope);
    }
    onSaved?.();
    toast.success(success);
    setOpen(false);
  }

  async function runSave(action: () => Promise<void>, success: string) {
    setSaving(true);
    try {
      await action();
      finishSave(success);
    } catch {
      toast.error("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const orgDefaultLabel =
    purpose === "bin" ? "Set as organization bin default" : "Set as organization serial default";

  const items: { label: string; onClick: () => void; show: boolean }[] = [
    {
      label: "Save template",
      show: Boolean(templateId && canManageSeries),
      onClick: () =>
        void runSave(async () => {
          if (!templateId) {
            throw new Error("Missing template id");
          }
          const result = await updateLabelTemplateRecord(templateId, template);
          if (!result.ok) throw new Error(result.message ?? "Failed");
        }, "Template saved."),
    },
    {
      label: "Use for bin printing",
      show: purpose === "bin",
      onClick: () =>
        void runSave(async () => {
          saveBinPrintTemplateOverride(template);
        }, "Saved for bin printing."),
    },
    {
      label: "Save for this print",
      show: Boolean(seriesCode),
      onClick: () =>
        void runSave(async () => {
          if (!seriesCode) {
            throw new Error("Missing series");
          }
          markLabelStudioCustomized({ kind: "series", series: seriesCode }, template);
        }, "Saved for this print."),
    },
    {
      label: "Save as series default",
      show: Boolean(canManageSeries && seriesCode && purpose === "serial"),
      onClick: () =>
        void runSave(async () => {
          if (!seriesCode) {
            throw new Error("Missing series");
          }
          const created = await createLabelTemplateRecord(
            template,
            `Series: ${seriesCode}`,
            "serial",
          );
          if (!created.ok || !created.templateId) {
            throw new Error(created.message ?? "Failed");
          }
          const linked = await saveSeriesLabelTemplate(seriesCode, created.templateId);
          if (!linked.ok) throw new Error(linked.message ?? "Failed");
        }, "Saved as series default."),
    },
    {
      label: orgDefaultLabel,
      show: Boolean(canManageSeries && purpose === "bin"),
      onClick: () =>
        void runSave(async () => {
          const result = await saveOrgBinDefaultLabelTemplate(
            template,
            undefined,
            templateId,
          );
          if (!result.ok) throw new Error(result.message ?? "Failed");
        }, "Saved as organization bin default."),
    },
    {
      label: orgDefaultLabel,
      show: Boolean(isAdmin && purpose === "serial"),
      onClick: () =>
        void runSave(async () => {
          const result = await saveOrgDefaultLabelTemplate(template);
          if (!result.ok) throw new Error(result.message ?? "Failed");
        }, "Saved as organization default."),
    },
    {
      label: "Save print override",
      show: Boolean(reservationId && purpose === "serial"),
      onClick: () =>
        void runSave(async () => {
          if (!reservationId) {
            throw new Error("Missing reservation");
          }
          const result = await savePrintTimeLabelOverride(reservationId, template);
          if (!result.ok) throw new Error(result.message ?? "Failed");
        }, "Print override saved."),
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {resolved ? (
        <span className="hidden rounded-full border border-border-subtle bg-muted/30 px-2.5 py-1 text-ds-xs text-muted-foreground sm:inline">
          Source: {resolvedSourceLabel(resolved.source)}
        </span>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled || saving}>
            <Save className="size-4" aria-hidden />
            Save
            <ChevronDown className="size-3.5 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-1">
          <p className="px-2 py-1.5 text-ds-xs font-medium text-muted-foreground">Save template</p>
          {items
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={saving}
                className={cn(
                  "flex w-full rounded-lg px-2 py-2 text-left text-ds-sm hover:bg-muted/60",
                  saving && "opacity-50",
                )}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))}
          {items.every((item) => !item.show) ? (
            <p className="px-2 py-2 text-ds-xs text-muted-foreground">
              No save options for this context.
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
