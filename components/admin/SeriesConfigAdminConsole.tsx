"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  createSeriesAdminAction,
  deleteSeriesAdminAction,
  upsertSeriesConfigAdminAction,
} from "@/app/actions/series-config-admin";
import { PageHeader } from "@/components/shared/PageHeader";
import { Chip } from "@/components/shared/Chip";
import { SurfaceCard, SurfaceCardDescription, SurfaceCardTitle } from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SeriesConfigAdminRow } from "@/lib/series-config-resolve";
import {
  normalizePrefixPatternInput,
  SERIES_PREFIX_PATTERN_WIDTH,
  validatePrefixPattern,
  validateRangeAlignsWithPrefixPattern,
} from "@/lib/series-prefix-pattern";
import { useServerMutation } from "@/lib/use-server-mutation";
import { normalizeSeriesCode } from "@/lib/series-codes";

type Draft = {
  code: string;
  displayName: string;
  prefixPattern: string;
  rangeStart: string;
  ceilingNumber: string;
  inactivityThresholdDays: string;
  ceilingAlertPct: string;
  sortOrder: string;
  isActive: boolean;
  reason: string;
};

function draftFromRow(row: SeriesConfigAdminRow): Draft {
  return {
    code: row.code,
    displayName: row.displayName,
    prefixPattern: row.prefixPattern,
    rangeStart: row.rangeStart,
    ceilingNumber: row.ceilingNumber,
    inactivityThresholdDays: String(row.inactivityThresholdDays),
    ceilingAlertPct: String(row.ceilingAlertPct),
    sortOrder: String(row.sortOrder),
    isActive: row.isActive,
    reason: "",
  };
}

function normalizeNumericInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

function draftAlignmentError(draft: Draft): string | null {
  const prefixError = validatePrefixPattern(draft.prefixPattern);
  if (prefixError) {
    return prefixError;
  }
  if (!draft.rangeStart.trim() || !draft.ceilingNumber.trim()) {
    return null;
  }
  try {
    return validateRangeAlignsWithPrefixPattern({
      prefixPattern: draft.prefixPattern,
      rangeStart: BigInt(draft.rangeStart),
      ceilingNumber: BigInt(draft.ceilingNumber),
    });
  } catch {
    return "Range start and ceiling must be valid numbers.";
  }
}

function FieldHint({ message, tone = "muted" }: { message: string; tone?: "muted" | "error" }) {
  return (
    <p
      className={
        tone === "error" ? "text-ds-xs text-destructive" : "text-ds-xs text-muted-foreground"
      }
    >
      {message}
    </p>
  );
}

export function SeriesConfigAdminConsole({ rows }: { rows: SeriesConfigAdminRow[] }) {
  const router = useRouter();
  const { isPending, run } = useServerMutation();
  const [createDraft, setCreateDraft] = React.useState<Draft>({
    code: "",
    displayName: "",
    prefixPattern: "",
    rangeStart: "",
    ceilingNumber: "",
    inactivityThresholdDays: "30",
    ceilingAlertPct: "80",
    sortOrder: "0",
    isActive: true,
    reason: "",
  });
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() =>
    Object.fromEntries(rows.map((row) => [row.code, draftFromRow(row)])),
  );
  const [deleteReasons, setDeleteReasons] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setDrafts(Object.fromEntries(rows.map((row) => [row.code, draftFromRow(row)])));
  }, [rows]);

  function updateDraft(code: string, patch: Partial<Draft>) {
    const key = code;
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key]!, ...patch },
    }));
  }

  async function handleCreate() {
    const alignmentError = draftAlignmentError(createDraft);
    if (alignmentError) {
      toast.error(alignmentError);
      return;
    }
    await run(async () => {
      const code = normalizeSeriesCode(createDraft.code);
      const res = await createSeriesAdminAction({
        code,
        displayName: createDraft.displayName,
        prefixPattern: createDraft.prefixPattern,
        rangeStart: createDraft.rangeStart,
        ceilingNumber: createDraft.ceilingNumber,
        inactivityThresholdDays: Number(createDraft.inactivityThresholdDays),
        ceilingAlertPct: Number(createDraft.ceilingAlertPct),
        sortOrder: Number(createDraft.sortOrder),
        reason: createDraft.reason,
      });
      if (!res.ok) {
        toast.error(res.message ?? "Create failed.");
        return;
      }
      toast.success(`${code} created.`);
      setCreateDraft((prev) => ({ ...prev, code: "", reason: "" }));
      router.refresh();
    });
  }

  async function handleSave(row: SeriesConfigAdminRow) {
    const draft = drafts[row.code]!;
    const alignmentError = draftAlignmentError(draft);
    if (alignmentError) {
      toast.error(alignmentError);
      return;
    }
    await run(async () => {
      const res = await upsertSeriesConfigAdminAction({
        code: row.code,
        displayName: draft.displayName,
        prefixPattern: draft.prefixPattern,
        rangeStart: draft.rangeStart,
        ceilingNumber: draft.ceilingNumber,
        inactivityThresholdDays: Number(draft.inactivityThresholdDays),
        ceilingAlertPct: Number(draft.ceilingAlertPct),
        sortOrder: Number(draft.sortOrder),
        isActive: draft.isActive,
        reason: draft.reason,
      });
      if (!res.ok) {
        toast.error(res.message ?? "Save failed.");
        return;
      }
      toast.success(`${draft.displayName} saved.`);
      updateDraft(row.code, { reason: "" });
      router.refresh();
    });
  }

  async function handleDelete(row: SeriesConfigAdminRow) {
    const reason = deleteReasons[row.code]?.trim() ?? "";
    if (!reason) {
      toast.error("Reason is required to delete.");
      return;
    }
    await run(async () => {
      const res = await deleteSeriesAdminAction({
        code: row.code,
        reason,
      });
      if (!res.ok) {
        toast.error(res.message ?? "Delete failed.");
        return;
      }
      toast.success(`${row.displayName} deleted.`);
      setDeleteReasons((prev) => ({ ...prev, [row.code]: "" }));
      router.refresh();
    });
  }

  const createAlignmentError = draftAlignmentError(createDraft);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/users" },
          { label: "Platform control", href: "/admin/platform" },
          { label: "Series config" },
        ]}
        title="Series configuration"
        subtitle="Configure prefix patterns, numeric bands, and alert thresholds. Range start and ceiling must match the prefix pattern (digits are fixed, X is variable)."
      />

      <SurfaceCard>
        <SurfaceCardTitle>Create series</SurfaceCardTitle>
        <SurfaceCardDescription className="mt-2">
          Add a new active series code. Values are audited and immediately available in governance flows.
        </SurfaceCardDescription>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="create-code">Code</Label>
            <Input
              id="create-code"
              value={createDraft.code}
              onChange={(e) => setCreateDraft((p) => ({ ...p, code: e.target.value }))}
              placeholder="LOCK_TAGS"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-displayName">Display name</Label>
            <Input
              id="create-displayName"
              value={createDraft.displayName}
              onChange={(e) => setCreateDraft((p) => ({ ...p, displayName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-prefix">Prefix pattern</Label>
            <Input
              id="create-prefix"
              value={createDraft.prefixPattern}
              onChange={(e) =>
                setCreateDraft((p) => ({
                  ...p,
                  prefixPattern: normalizePrefixPatternInput(e.target.value),
                }))
              }
              placeholder="000XXXXXXX"
              maxLength={SERIES_PREFIX_PATTERN_WIDTH}
              className="font-mono"
            />
            <FieldHint message="10 characters: 0–9 are fixed digits, X is variable. Example: 000XXXXXXX for lock tags." />
            {createDraft.prefixPattern ? (
              <FieldHint
                tone={validatePrefixPattern(createDraft.prefixPattern) ? "error" : "muted"}
                message={
                  validatePrefixPattern(createDraft.prefixPattern) ??
                  `${createDraft.prefixPattern.length}/${SERIES_PREFIX_PATTERN_WIDTH} characters`
                }
              />
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-rangeStart">Range start</Label>
            <Input
              id="create-rangeStart"
              value={createDraft.rangeStart}
              onChange={(e) =>
                setCreateDraft((p) => ({ ...p, rangeStart: normalizeNumericInput(e.target.value) }))
              }
              inputMode="numeric"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-ceiling">Ceiling</Label>
            <Input
              id="create-ceiling"
              value={createDraft.ceilingNumber}
              onChange={(e) =>
                setCreateDraft((p) => ({
                  ...p,
                  ceilingNumber: normalizeNumericInput(e.target.value),
                }))
              }
              inputMode="numeric"
              className="font-mono"
            />
            {createAlignmentError ? <FieldHint tone="error" message={createAlignmentError} /> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-sortOrder">Sort order</Label>
            <Input
              id="create-sortOrder"
              type="number"
              value={createDraft.sortOrder}
              onChange={(e) => setCreateDraft((p) => ({ ...p, sortOrder: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="create-reason">Reason</Label>
          <Textarea
            id="create-reason"
            rows={2}
            value={createDraft.reason}
            onChange={(e) => setCreateDraft((p) => ({ ...p, reason: e.target.value }))}
            placeholder="Required — recorded in audit log"
          />
        </div>
        <div className="mt-4">
          <Button
            type="button"
            disabled={isPending || Boolean(createAlignmentError)}
            onClick={() => void handleCreate()}
          >
            Create series
          </Button>
        </div>
      </SurfaceCard>

      <div className="space-y-4">
        {rows.map((row) => {
          const key = row.code;
          const draft = drafts[key] ?? draftFromRow(row);
          const alignmentError = draftAlignmentError(draft);
          return (
            <SurfaceCard key={row.code} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SurfaceCardTitle>{row.displayName}</SurfaceCardTitle>
                    <Chip tone={row.isActive ? "success" : "neutral"} size="sm">
                      {row.isActive ? "Active" : "Inactive"}
                    </Chip>
                  </div>
                  <SurfaceCardDescription className="mt-1 font-mono text-ds-xs">
                    {row.code} · range starts at {row.rangeStart}
                  </SurfaceCardDescription>
                  {row.configuredAt ? (
                    <p className="mt-1 text-ds-xs text-muted-foreground">
                      Last saved {new Date(row.configuredAt).toLocaleString()}
                      {row.configuredByName ? ` by ${row.configuredByName}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${key}-displayName`}>Display name</Label>
                  <Input
                    id={`${key}-displayName`}
                    value={draft.displayName}
                    onChange={(e) => updateDraft(row.code, { displayName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${key}-prefix`}>Prefix pattern</Label>
                  <Input
                    id={`${key}-prefix`}
                    value={draft.prefixPattern}
                    onChange={(e) =>
                      updateDraft(row.code, {
                        prefixPattern: normalizePrefixPatternInput(e.target.value),
                      })
                    }
                    maxLength={SERIES_PREFIX_PATTERN_WIDTH}
                    className="font-mono"
                  />
                  {draft.prefixPattern ? (
                    <FieldHint
                      tone={validatePrefixPattern(draft.prefixPattern) ? "error" : "muted"}
                      message={
                        validatePrefixPattern(draft.prefixPattern) ??
                        `${draft.prefixPattern.length}/${SERIES_PREFIX_PATTERN_WIDTH} characters`
                      }
                    />
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${key}-rangeStart`}>Range start</Label>
                  <Input
                    id={`${key}-rangeStart`}
                    value={draft.rangeStart}
                    onChange={(e) =>
                      updateDraft(row.code, { rangeStart: normalizeNumericInput(e.target.value) })
                    }
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${key}-ceiling`}>Range ceiling</Label>
                  <Input
                    id={`${key}-ceiling`}
                    value={draft.ceilingNumber}
                    onChange={(e) =>
                      updateDraft(row.code, {
                        ceilingNumber: normalizeNumericInput(e.target.value),
                      })
                    }
                    inputMode="numeric"
                    className="font-mono"
                  />
                  {alignmentError ? <FieldHint tone="error" message={alignmentError} /> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${key}-inactivity`}>Inactivity threshold (days)</Label>
                  <Input
                    id={`${key}-inactivity`}
                    type="number"
                    min={1}
                    max={365}
                    value={draft.inactivityThresholdDays}
                    onChange={(e) =>
                      updateDraft(row.code, { inactivityThresholdDays: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${key}-alert`}>Ceiling alert (%)</Label>
                  <Input
                    id={`${key}-alert`}
                    type="number"
                    min={1}
                    max={100}
                    value={draft.ceilingAlertPct}
                    onChange={(e) => updateDraft(row.code, { ceilingAlertPct: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${key}-sortOrder`}>Sort order</Label>
                  <Input
                    id={`${key}-sortOrder`}
                    type="number"
                    value={draft.sortOrder}
                    onChange={(e) => updateDraft(row.code, { sortOrder: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${key}-reason`}>Reason for save</Label>
                <Textarea
                  id={`${key}-reason`}
                  value={draft.reason}
                  onChange={(e) => updateDraft(row.code, { reason: e.target.value })}
                  placeholder="Required — recorded in audit log"
                  rows={2}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={isPending || Boolean(alignmentError)}
                  onClick={() => void handleSave(row)}
                >
                  Save changes
                </Button>
                {row.canDelete ? (
                  <>
                    <Input
                      className="max-w-xs"
                      value={deleteReasons[key] ?? ""}
                      onChange={(e) =>
                        setDeleteReasons((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="Reason to delete"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => void handleDelete(row)}
                    >
                      Delete series
                    </Button>
                  </>
                ) : null}
              </div>
            </SurfaceCard>
          );
        })}
      </div>
    </div>
  );
}
