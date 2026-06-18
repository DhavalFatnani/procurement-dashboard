"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  saveOrgDefaultLabelTemplate,
  savePrintTimeLabelOverride,
  saveSeriesLabelTemplate,
  createLabelTemplateRecord,
} from "@/app/actions/label-templates";
import type { LabelTemplate, ResolvedLabelTemplate } from "@/lib/label-template-types";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export function TemplateSaveBar({
  template,
  seriesCode,
  reservationId,
  resolved,
  isAdmin,
  canManageSeries,
  disabled,
}: {
  template: LabelTemplate;
  seriesCode?: string;
  reservationId?: string;
  resolved?: ResolvedLabelTemplate;
  isAdmin?: boolean;
  canManageSeries?: boolean;
  disabled?: boolean;
}) {
  const [saving, setSaving] = React.useState(false);

  async function handleSaveOrgDefault() {
    setSaving(true);
    try {
      const result = await saveOrgDefaultLabelTemplate(template);
      if (result.ok) {
        toast.success("Saved as organization default template.");
      } else {
        toast.error(result.message ?? "Failed to save org default.");
      }
    } catch {
      toast.error("Failed to save org default.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSeries() {
    if (!seriesCode) return;
    setSaving(true);
    try {
      const created = await createLabelTemplateRecord(template, `Series: ${seriesCode}`);
      if (!created.ok || !created.templateId) {
        toast.error(created.message ?? "Failed to create template.");
        return;
      }
      const linked = await saveSeriesLabelTemplate(seriesCode, created.templateId);
      if (linked.ok) {
        toast.success("Saved as series override.");
      } else {
        toast.error(linked.message ?? "Failed to link series template.");
      }
    } catch {
      toast.error("Failed to save series template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePrintOverride() {
    if (!reservationId) return;
    setSaving(true);
    try {
      const result = await savePrintTimeLabelOverride(reservationId, template);
      if (result.ok) {
        toast.success("Print-time override saved.");
      } else {
        toast.error(result.message ?? "Failed to save override.");
      }
    } catch {
      toast.error("Failed to save override.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-muted/20 px-3 py-2">
      <span className="text-ds-xs text-muted-foreground">
        Source: {resolved?.source?.replace(/_/g, " ") ?? "draft"}
      </span>
      {reservationId ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={() => void handleSavePrintOverride()}
        >
          <Save className="size-3.5" aria-hidden />
          Print override
        </Button>
      ) : null}
      {canManageSeries && seriesCode ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={() => void handleSaveSeries()}
        >
          <Save className="size-3.5" aria-hidden />
          Series default
        </Button>
      ) : null}
      {isAdmin ? (
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={disabled || saving}
          onClick={() => void handleSaveOrgDefault()}
        >
          <Save className="size-3.5" aria-hidden />
          Org default
        </Button>
      ) : null}
    </div>
  );
}
