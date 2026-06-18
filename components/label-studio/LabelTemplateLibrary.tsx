"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createLabelTemplateRecord,
  deleteLabelTemplate,
  duplicateLabelTemplate,
  listLabelTemplates,
} from "@/app/actions/label-templates";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { getBinReferencePreset, getReferencePreset } from "@/lib/label-template-presets";
import type { LabelTemplateListItem, LabelTemplatePurpose } from "@/lib/label-template-types";
import { buildLabelStudioUrl } from "@/lib/label-studio-url";
import { cn } from "@/lib/utils";
import { ArrowLeft, Copy, Pencil, Plus, Trash2 } from "lucide-react";

const PURPOSE_LABELS: Record<LabelTemplatePurpose, { title: string; subtitle: string }> = {
  serial: {
    title: "Serial label templates",
    subtitle: "Used for lock tags and serial batch printing across any series.",
  },
  bin: {
    title: "Bin label templates",
    subtitle: "Used for warehouse bin and location labels.",
  },
};

export function LabelTemplateLibrary({
  purpose,
  canManage,
}: {
  purpose: LabelTemplatePurpose;
  canManage: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<LabelTemplateListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const labels = PURPOSE_LABELS[purpose];

  const refresh = React.useCallback(() => {
    setLoading(true);
    void listLabelTemplates({ purpose }).then((result) => {
      setItems(result.items);
      setLoading(false);
    });
  }, [purpose]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleNewTemplate() {
    setCreating(true);
    try {
      const starter = purpose === "bin" ? getBinReferencePreset() : getReferencePreset();
      const result = await createLabelTemplateRecord(
        starter,
        purpose === "bin" ? "New bin template" : "New serial template",
        purpose,
      );
      if (!result.ok || !result.templateId) {
        throw new Error(result.message ?? "Failed to create template");
      }
      router.push(
        buildLabelStudioUrl({
          view: "editor",
          purpose,
          templateId: result.templateId,
        }),
      );
    } catch {
      toast.error("Could not create template.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(id: string) {
    const result = await duplicateLabelTemplate(id);
    if (!result.ok) {
      toast.error(result.message ?? "Duplicate failed.");
      return;
    }
    toast.success("Template duplicated.");
    refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const result = await deleteLabelTemplate(id);
    if (!result.ok) {
      toast.error(result.message ?? "Delete failed.");
      return;
    }
    toast.success("Template deleted.");
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href={buildLabelStudioUrl({ view: "hub" })}
            className="inline-flex items-center gap-1 text-ds-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Label Studio
          </Link>
          <PageHeader title={labels.title} subtitle={labels.subtitle} />
        </div>
        {canManage ? (
          <Button type="button" onClick={() => void handleNewTemplate()} disabled={creating}>
            <Plus className="size-4" aria-hidden />
            New template
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-ds-sm text-muted-foreground">Loading templates…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle p-8 text-center">
          <p className="text-ds-sm text-muted-foreground">No saved templates yet.</p>
          {canManage ? (
            <Button
              type="button"
              className="mt-4"
              variant="outline"
              onClick={() => void handleNewTemplate()}
              disabled={creating}
            >
              Create your first template
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-card">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-ds-sm font-medium text-foreground">{item.name}</p>
                  {item.isOrgDefault ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-ds-2xs font-medium text-primary">
                      Org default
                    </span>
                  ) : null}
                </div>
                {item.description ? (
                  <p className="mt-0.5 text-ds-xs text-muted-foreground">{item.description}</p>
                ) : null}
                <p className="mt-1 text-ds-2xs text-muted-foreground/80">
                  Updated {new Date(item.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <Link
                  href={buildLabelStudioUrl({
                    view: "editor",
                    purpose,
                    templateId: item.id,
                  })}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Link>
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDuplicate(item.id)}
                    >
                      <Copy className="size-3.5" aria-hidden />
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(item.id, item.name)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Delete
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
