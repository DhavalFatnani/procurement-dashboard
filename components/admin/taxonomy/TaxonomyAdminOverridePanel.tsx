"use client";

import { CategoryBillingGranularity, ExecutionType } from "@/lib/prisma-enums";
import * as React from "react";
import { toast } from "sonner";

import {
  adminApproveAllPendingInSubcategory,
  adminCascadeDeactivateCategory,
  adminCascadeDeactivateSubcategory,
  adminForceDeactivateCategory,
  adminForceDeactivateSubcategory,
  adminHardDeleteTaxonomyNode,
  adminMergeSubcategories,
  adminOverrideBillingGranularity,
  adminOverrideExecution,
  adminReassignSubcategory,
  type AdminReassignGranularityResolution,
} from "@/app/actions/taxonomy-admin";
import { AdminReasonDialog } from "@/components/admin/taxonomy/AdminReasonDialog";
import type { TaxonomyNodeRef } from "@/lib/taxonomy-node";
import type { SeriesOption } from "@/components/admin/SubcategoryFormDrawer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SurfaceCard, SurfaceCardDescription, SurfaceCardTitle } from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BILLING_GRANULARITY_LABEL } from "@/lib/taxonomy-labels";
import type { CatalogItemListRow } from "@/lib/queries/catalog";
import type { TaxonomyImpact } from "@/lib/queries/taxonomy-impact";
import type {
  CategoryListRow,
  SubcategoryListRow,
  TaxonomyCategoryOption,
  TaxonomySubcategoryOption,
} from "@/lib/queries/taxonomy";

type DialogKind =
  | "cascade-category"
  | "force-category"
  | "cascade-subcategory"
  | "force-subcategory"
  | "reassign"
  | "override-billing"
  | "override-execution"
  | "merge"
  | "bulk-approve"
  | "hard-delete";

type ReassignResolutionMode = "align-target-to-source" | "align-source-to-target" | "custom";

export function TaxonomyAdminOverridePanel({
  node,
  category,
  subcategory,
  catalogItem,
  impact,
  categories,
  subcategories,
  seriesOptions,
  onChanged,
}: {
  node: TaxonomyNodeRef;
  category: CategoryListRow | null;
  subcategory: SubcategoryListRow | null;
  catalogItem: CatalogItemListRow | null;
  impact: TaxonomyImpact | null;
  categories: TaxonomyCategoryOption[];
  subcategories: TaxonomySubcategoryOption[];
  seriesOptions: SeriesOption[];
  onChanged: () => void;
}) {
  const [dialog, setDialog] = React.useState<DialogKind | null>(null);
  const [pending, setPending] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [targetCategoryId, setTargetCategoryId] = React.useState("");
  const [reassignResolution, setReassignResolution] =
    React.useState<ReassignResolutionMode>("align-target-to-source");
  const [customGranularity, setCustomGranularity] = React.useState<CategoryBillingGranularity>(
    CategoryBillingGranularity.SUBCATEGORY,
  );
  const [overrideBillingCategoryId, setOverrideBillingCategoryId] = React.useState("");
  const [mergeTargetId, setMergeTargetId] = React.useState("");
  const [billingGranularity, setBillingGranularity] = React.useState<CategoryBillingGranularity>(
    CategoryBillingGranularity.SUBCATEGORY,
  );
  const [executionType, setExecutionType] = React.useState<ExecutionType>(
    ExecutionType.VENDOR_PURCHASE,
  );
  const [series, setSeries] = React.useState<string>("");

  const sourceCategory = React.useMemo(
    () => (subcategory ? categories.find((c) => c.id === subcategory.categoryId) : null),
    [categories, subcategory],
  );
  const targetCategory = React.useMemo(
    () => (targetCategoryId ? categories.find((c) => c.id === targetCategoryId) : null),
    [categories, targetCategoryId],
  );
  const granularityMismatch =
    sourceCategory &&
    targetCategory &&
    sourceCategory.billingGranularity !== targetCategory.billingGranularity;

  React.useEffect(() => {
    if (!dialog) return;
    setReason("");
    if (category) setBillingGranularity(category.billingGranularity);
    if (subcategory) {
      setExecutionType(subcategory.executionType);
      setSeries(subcategory.series ?? "");
      setOverrideBillingCategoryId(subcategory.categoryId);
      setCustomGranularity(
        categories.find((c) => c.id === subcategory.categoryId)?.billingGranularity ??
          CategoryBillingGranularity.SUBCATEGORY,
      );
    }
    if (dialog === "reassign") {
      setTargetCategoryId("");
      setReassignResolution("align-target-to-source");
    }
  }, [dialog, category, subcategory, categories]);

  async function runAction(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setPending(true);
    try {
      const res = await fn();
      if (res.ok) {
        toast.success("Admin override applied.");
        setDialog(null);
        onChanged();
      } else {
        toast.error(res.message ?? "Action failed.");
      }
    } finally {
      setPending(false);
    }
  }

  const hasOpenPrs = (impact?.openPurchaseRequests ?? 0) > 0;

  function closeDialog() {
    if (!pending) setDialog(null);
  }

  function openOverrideBilling(categoryId: string, current: CategoryBillingGranularity) {
    setOverrideBillingCategoryId(categoryId);
    setBillingGranularity(current);
    setDialog("override-billing");
  }

  function buildReassignGranularityResolution(): AdminReassignGranularityResolution | undefined {
    if (!granularityMismatch || !targetCategory) return undefined;
    if (reassignResolution === "align-target-to-source") return "align-target-to-source";
    if (reassignResolution === "align-source-to-target") return "align-source-to-target";
    return {
      categoryId: targetCategory.id,
      billingGranularity: customGranularity,
    };
  }

  const overrideBillingTarget =
    node.type === "category"
      ? category
      : categories.find((c) => c.id === overrideBillingCategoryId);

  return (
    <div className="space-y-4">
      <SurfaceCard className="space-y-4 border-primary/20">
        <div>
          <SurfaceCardTitle>Structure</SurfaceCardTitle>
          <SurfaceCardDescription className="mt-1">
            Move subcategories or change billing granularity. Reason required; changes are audited.
          </SurfaceCardDescription>
        </div>

        <div className="flex flex-wrap gap-2">
          {node.type === "category" && category ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => openOverrideBilling(category.id, category.billingGranularity)}
            >
              Change billing granularity
            </Button>
          ) : null}

          {node.type === "subcategory" && subcategory && sourceCategory ? (
            <>
              <Button type="button" variant="default" size="sm" onClick={() => setDialog("reassign")}>
                Move to category…
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  openOverrideBilling(sourceCategory.id, sourceCategory.billingGranularity)
                }
              >
                Change parent billing
              </Button>
            </>
          ) : null}
        </div>

        {node.type === "subcategory" && sourceCategory ? (
          <p className="text-ds-xs text-muted-foreground">
            Current parent: {sourceCategory.name} ·{" "}
            {BILLING_GRANULARITY_LABEL[sourceCategory.billingGranularity]}
          </p>
        ) : null}
      </SurfaceCard>

      <SurfaceCard className="space-y-4 border-destructive/20">
        <div>
          <SurfaceCardTitle>Destructive overrides</SurfaceCardTitle>
          <SurfaceCardDescription className="mt-1">
            Cascade deactivation, force actions, merge, and hard delete.
          </SurfaceCardDescription>
        </div>

        <div className="flex flex-wrap gap-2">
          {node.type === "category" && category ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialog("cascade-category")}>
                Cascade deactivate
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => setDialog("force-category")}>
                Force deactivate
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDialog("hard-delete")}>
                Hard delete
              </Button>
            </>
          ) : null}

          {node.type === "subcategory" && subcategory ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialog("cascade-subcategory")}>
                Cascade deactivate
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => setDialog("force-subcategory")}>
                Force deactivate
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialog("override-execution")}>
                Override execution / series
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialog("merge")}>
                Merge into…
              </Button>
              {(impact?.catalogItems.pending ?? 0) > 0 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setDialog("bulk-approve")}>
                  Approve all pending
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setDialog("hard-delete")}>
                Hard delete
              </Button>
            </>
          ) : null}

          {node.type === "item" && catalogItem ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setDialog("hard-delete")}>
              Hard delete
            </Button>
          ) : null}
        </div>

        {hasOpenPrs ? (
          <p className="text-ds-xs text-muted-foreground">
            Open PRs detected — use force deactivate to acknowledge and proceed.
          </p>
        ) : null}
      </SurfaceCard>

      <AdminReasonDialog
        open={dialog === "cascade-category"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Cascade deactivate category"
        description="Deactivates this category, all subcategories, and inactivates catalog items."
        confirmLabel="Cascade deactivate"
        pending={pending}
        onConfirm={(r) => void runAction(() => adminCascadeDeactivateCategory(category!.id, r))}
      />

      <AdminReasonDialog
        open={dialog === "force-category"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Force deactivate category"
        description="Deactivates despite open purchase request references."
        confirmLabel="Force deactivate"
        pending={pending}
        onConfirm={(r) => void runAction(() => adminForceDeactivateCategory(category!.id, r))}
      />

      <AdminReasonDialog
        open={dialog === "cascade-subcategory"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Cascade deactivate subcategory"
        description="Deactivates this subcategory and inactivates its catalog items."
        confirmLabel="Cascade deactivate"
        pending={pending}
        onConfirm={(r) => void runAction(() => adminCascadeDeactivateSubcategory(subcategory!.id, r))}
      />

      <AdminReasonDialog
        open={dialog === "force-subcategory"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Force deactivate subcategory"
        description="Deactivates despite open purchase request references."
        confirmLabel="Force deactivate"
        pending={pending}
        onConfirm={(r) => void runAction(() => adminForceDeactivateSubcategory(subcategory!.id, r))}
      />

      <AdminReasonDialog
        open={dialog === "bulk-approve"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Approve all pending catalog items"
        description={`Approves ${impact?.catalogItems.pending ?? 0} pending item(s) in this subcategory.`}
        confirmLabel="Approve all"
        pending={pending}
        onConfirm={(r) => void runAction(() => adminApproveAllPendingInSubcategory(subcategory!.id, r))}
      />

      <AdminReasonDialog
        open={dialog === "hard-delete"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Hard delete"
        description="Permanent removal when unused. Stricter than deactivate."
        confirmLabel="Hard delete"
        pending={pending}
        onConfirm={(r) =>
          void runAction(() =>
            adminHardDeleteTaxonomyNode({
              nodeType:
                node.type === "category"
                  ? "category"
                  : node.type === "subcategory"
                    ? "subcategory"
                    : "catalogItem",
              nodeId: node.id,
              reason: r,
            }),
          )
        }
      />

      <ConfirmDialog
        open={dialog === "reassign"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Move subcategory to another category"
        confirmLabel="Move subcategory"
        confirmVariant="destructive"
        closeOnConfirm={false}
        pending={pending}
        confirmDisabled={!targetCategoryId || !reason.trim()}
        body={
          <div className="space-y-3">
            <p>
              Moves <strong>{subcategory?.name}</strong> from {sourceCategory?.name} to a new parent.
              If billing granularity differs, choose how to align before confirming.
            </p>
            <div className="space-y-2">
              <Label>Target category</Label>
              <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.id !== subcategory?.categoryId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {BILLING_GRANULARITY_LABEL[c.billingGranularity]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {granularityMismatch && sourceCategory && targetCategory ? (
              <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3">
                <p className="text-ds-sm font-medium text-amber-900 dark:text-amber-100">
                  Billing granularity mismatch
                </p>
                <p className="text-ds-xs text-muted-foreground">
                  Source: {BILLING_GRANULARITY_LABEL[sourceCategory.billingGranularity]} · Target:{" "}
                  {BILLING_GRANULARITY_LABEL[targetCategory.billingGranularity]}
                </p>
                <div className="space-y-2">
                  <Label>Align before move</Label>
                  <Select
                    value={reassignResolution}
                    onValueChange={(v) => setReassignResolution(v as ReassignResolutionMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="align-target-to-source">
                        Update target ({targetCategory.name}) to{" "}
                        {BILLING_GRANULARITY_LABEL[sourceCategory.billingGranularity]}
                      </SelectItem>
                      <SelectItem value="align-source-to-target">
                        Update source ({sourceCategory.name}) to{" "}
                        {BILLING_GRANULARITY_LABEL[targetCategory.billingGranularity]}
                      </SelectItem>
                      <SelectItem value="custom">
                        Set target ({targetCategory.name}) to a specific granularity
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {reassignResolution === "custom" ? (
                  <div className="space-y-2">
                    <Label>Target category granularity</Label>
                    <Select
                      value={customGranularity}
                      onValueChange={(v) =>
                        setCustomGranularity(v as CategoryBillingGranularity)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CategoryBillingGranularity.SUBCATEGORY}>
                          Subcategory quantity
                        </SelectItem>
                        <SelectItem value={CategoryBillingGranularity.CATALOG_ITEM}>
                          Catalog items
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}

            <ReasonField reason={reason} onChange={setReason} />
          </div>
        }
        onConfirm={() =>
          void runAction(() =>
            adminReassignSubcategory({
              subcategoryId: subcategory!.id,
              targetCategoryId,
              reason,
              granularityResolution: buildReassignGranularityResolution(),
            }),
          )
        }
      />

      <ConfirmDialog
        open={dialog === "override-billing"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Change billing granularity"
        confirmLabel="Update granularity"
        confirmVariant="destructive"
        closeOnConfirm={false}
        pending={pending}
        confirmDisabled={!reason.trim() || !overrideBillingCategoryId}
        body={
          <div className="space-y-3">
            <p>
              Updates <strong>{overrideBillingTarget?.name ?? "category"}</strong>. Bypasses the
              standard lock after PR line history.
            </p>
            {overrideBillingTarget ? (
              <p className="text-ds-xs text-muted-foreground">
                Current: {BILLING_GRANULARITY_LABEL[overrideBillingTarget.billingGranularity]}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label>New billing granularity</Label>
              <Select
                value={billingGranularity}
                onValueChange={(v) => setBillingGranularity(v as CategoryBillingGranularity)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CategoryBillingGranularity.SUBCATEGORY}>
                    Subcategory quantity
                  </SelectItem>
                  <SelectItem value={CategoryBillingGranularity.CATALOG_ITEM}>Catalog items</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ReasonField reason={reason} onChange={setReason} />
          </div>
        }
        onConfirm={() =>
          void runAction(() =>
            adminOverrideBillingGranularity({
              categoryId: overrideBillingCategoryId,
              billingGranularity,
              reason,
            }),
          )
        }
      />

      <ConfirmDialog
        open={dialog === "override-execution"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Override execution / series"
        confirmLabel="Override"
        confirmVariant="destructive"
        closeOnConfirm={false}
        pending={pending}
        confirmDisabled={
          !reason.trim() ||
          (executionType === ExecutionType.INTERNAL_PRINT && !series.trim())
        }
        body={
          <div className="space-y-3">
            <p>Bypasses the standard lock after purchase or serial use.</p>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Execution type</Label>
                <Select
                  value={executionType}
                  onValueChange={(v) => setExecutionType(v as ExecutionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ExecutionType.VENDOR_PURCHASE}>Vendor purchase</SelectItem>
                    <SelectItem value={ExecutionType.INTERNAL_PRINT}>Internal print</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {executionType === ExecutionType.INTERNAL_PRINT ? (
                <div className="space-y-2">
                  <Label>Serial series</Label>
                  <Select value={series} onValueChange={setSeries}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select series" />
                    </SelectTrigger>
                    <SelectContent>
                      {seriesOptions.map((opt) => (
                        <SelectItem key={opt.code} value={opt.code}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <ReasonField reason={reason} onChange={setReason} />
          </div>
        }
        onConfirm={() =>
          void runAction(() =>
            adminOverrideExecution({
              subcategoryId: subcategory!.id,
              executionType,
              series: executionType === ExecutionType.INTERNAL_PRINT ? series : null,
              reason,
            }),
          )
        }
      />

      <ConfirmDialog
        open={dialog === "merge"}
        onOpenChange={(open) => !open && closeDialog()}
        title="Merge subcategories"
        confirmLabel="Merge"
        confirmVariant="destructive"
        closeOnConfirm={false}
        pending={pending}
        confirmDisabled={!mergeTargetId || !reason.trim()}
        body={
          <div className="space-y-3">
            <p>Moves all catalog items to the target subcategory and deactivates the source.</p>
            <div className="space-y-2">
              <Label>Target subcategory</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories
                    .filter(
                      (s) =>
                        s.id !== subcategory?.id &&
                        s.categoryId === subcategory?.categoryId &&
                        s.executionType === subcategory?.executionType,
                    )
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <ReasonField reason={reason} onChange={setReason} />
          </div>
        }
        onConfirm={() =>
          void runAction(() =>
            adminMergeSubcategories({
              sourceSubcategoryId: subcategory!.id,
              targetSubcategoryId: mergeTargetId,
              reason,
            }),
          )
        }
      />
    </div>
  );
}

function ReasonField({
  reason,
  onChange,
}: {
  reason: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="override-reason">Reason</Label>
      <Textarea
        id="override-reason"
        rows={3}
        value={reason}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Required — recorded in audit log"
      />
    </div>
  );
}
