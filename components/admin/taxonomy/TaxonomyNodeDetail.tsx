"use client";

import Link from "next/link";
import { CatalogItemStatus, ExecutionType, TaxonomyStatus } from "@/lib/prisma-enums";
import { Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
  deactivateCategory,
  deactivateSubcategory,
  deleteCategory,
  deleteSubcategory,
  reactivateCategory,
  reactivateSubcategory,
} from "@/app/actions/taxonomy";
import { CatalogItemFormDrawer } from "@/components/admin/CatalogItemFormDrawer";
import { CatalogRowActions } from "@/components/admin/CatalogRowActions";
import { CategoryFormDrawer } from "@/components/admin/CategoryFormDrawer";
import { SubcategoryFormDrawer } from "@/components/admin/SubcategoryFormDrawer";
import type { SeriesOption } from "@/components/admin/SubcategoryFormDrawer";
import { TaxonomyAdminOverridePanel } from "@/components/admin/taxonomy/TaxonomyAdminOverridePanel";
import { TaxonomyImpactCard } from "@/components/admin/taxonomy/TaxonomyImpactCard";
import type { TaxonomyNodeRef } from "@/lib/taxonomy-node";
import { Chip } from "@/components/shared/Chip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { SurfaceCard, SurfaceCardDescription, SurfaceCardTitle } from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import type { CatalogItemListRow } from "@/lib/queries/catalog";
import type { TaxonomyImpact } from "@/lib/queries/taxonomy-impact";
import type {
  CategoryListRow,
  SubcategoryListRow,
  TaxonomyCategoryOption,
  TaxonomySubcategoryOption,
} from "@/lib/queries/taxonomy";
import { BILLING_GRANULARITY_LABEL } from "@/lib/taxonomy-labels";

const EXECUTION_LABEL: Record<ExecutionType, string> = {
  [ExecutionType.VENDOR_PURCHASE]: "Vendor purchase",
  [ExecutionType.INTERNAL_PRINT]: "Internal print",
};

export function TaxonomyNodeDetail({
  node,
  category,
  subcategory,
  catalogItem,
  catalogItems,
  impact,
  isAdmin,
  categories,
  subcategories,
  seriesOptions,
  onChanged,
  onSelectNode,
}: {
  node: TaxonomyNodeRef | null;
  category: CategoryListRow | null;
  subcategory: SubcategoryListRow | null;
  catalogItem: CatalogItemListRow | null;
  catalogItems: CatalogItemListRow[];
  impact: TaxonomyImpact | null;
  isAdmin: boolean;
  categories: TaxonomyCategoryOption[];
  subcategories: TaxonomySubcategoryOption[];
  seriesOptions: SeriesOption[];
  onChanged: () => void;
  onSelectNode: (node: TaxonomyNodeRef) => void;
}) {
  const [editCategoryOpen, setEditCategoryOpen] = React.useState(false);
  const [editSubcategoryOpen, setEditSubcategoryOpen] = React.useState(false);
  const [createItemOpen, setCreateItemOpen] = React.useState(false);
  const [editItemOpen, setEditItemOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<(() => Promise<void>) | null>(null);
  const [confirmTitle, setConfirmTitle] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (!node) {
    return (
      <EmptyState
        title="Select a taxonomy node"
        description="Choose a category or subcategory from the tree to view impact, blockers, and actions."
      />
    );
  }

  async function runMutation(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    successMessage: string,
  ) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok) {
        toast.success(successMessage);
        onChanged();
      } else {
        toast.error(res.message ?? "Action failed.");
      }
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  function openConfirm(title: string, action: () => Promise<void>) {
    setConfirmTitle(title);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }

  return (
    <div className="space-y-4">
      {node.type === "category" && category ? (
        <SurfaceCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SurfaceCardTitle>{category.name}</SurfaceCardTitle>
              <SurfaceCardDescription className="mt-1">Category</SurfaceCardDescription>
            </div>
            <Chip
              tone={category.status === TaxonomyStatus.ACTIVE ? "success" : "neutral"}
              size="sm"
            >
              {category.status === TaxonomyStatus.ACTIVE ? "Active" : "Inactive"}
            </Chip>
          </div>
          <dl className="grid gap-2 text-ds-sm sm:grid-cols-2">
            <div>
              <dt className="text-ds-xs text-muted-foreground">Billing granularity</dt>
              <dd>{BILLING_GRANULARITY_LABEL[category.billingGranularity]}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Subcategories</dt>
              <dd className="tabular-nums">{category.subcategoryCount}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditCategoryOpen(true)}>
              Edit
            </Button>
            {category.status === TaxonomyStatus.ACTIVE ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  openConfirm(`Deactivate “${category.name}”?`, async () => {
                    await runMutation(
                      () => deactivateCategory(category.id),
                      "Category deactivated.",
                    );
                  })
                }
              >
                Deactivate
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void runMutation(
                    () => reactivateCategory(category.id),
                    "Category reactivated.",
                  )
                }
              >
                Reactivate
              </Button>
            )}
            {category.prUsageCount === 0 && category.subcategoryCount === 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  openConfirm(`Delete “${category.name}”?`, async () => {
                    await runMutation(() => deleteCategory(category.id), "Category deleted.");
                  })
                }
              >
                Delete
              </Button>
            ) : null}
          </div>
          <CategoryFormDrawer
            open={editCategoryOpen}
            onOpenChange={setEditCategoryOpen}
            mode={{ kind: "edit", category }}
            onSaved={onChanged}
          />
        </SurfaceCard>
      ) : null}

      {node.type === "subcategory" && subcategory ? (
        <SurfaceCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SurfaceCardTitle>{subcategory.name}</SurfaceCardTitle>
              <SurfaceCardDescription className="mt-1">
                Subcategory under {subcategory.categoryName}
              </SurfaceCardDescription>
            </div>
            <Chip
              tone={subcategory.status === TaxonomyStatus.ACTIVE ? "success" : "neutral"}
              size="sm"
            >
              {subcategory.status === TaxonomyStatus.ACTIVE ? "Active" : "Inactive"}
            </Chip>
          </div>
          <dl className="grid gap-2 text-ds-sm sm:grid-cols-2">
            <div>
              <dt className="text-ds-xs text-muted-foreground">Parent category</dt>
              <dd>{subcategory.categoryName}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Parent billing</dt>
              <dd>
                {(() => {
                  const billing = categories.find((c) => c.id === subcategory.categoryId)
                    ?.billingGranularity;
                  return billing ? BILLING_GRANULARITY_LABEL[billing] : "—";
                })()}
              </dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Execution</dt>
              <dd>{EXECUTION_LABEL[subcategory.executionType]}</dd>
            </div>
            {subcategory.series ? (
              <div>
                <dt className="text-ds-xs text-muted-foreground">Series</dt>
                <dd>
                  <Link
                    href={`/admin/platform/series?code=${encodeURIComponent(subcategory.series)}`}
                    className="font-mono text-ds-xs text-primary hover:underline"
                  >
                    {subcategory.seriesLabel ?? subcategory.series}
                  </Link>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-ds-xs text-muted-foreground">Catalog items</dt>
              <dd className="tabular-nums">{subcategory.catalogItemCount}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditSubcategoryOpen(true)}
            >
              Edit
            </Button>
            {subcategory.executionType === ExecutionType.VENDOR_PURCHASE ? (
              <Button type="button" size="sm" onClick={() => setCreateItemOpen(true)}>
                <Plus className="size-4" strokeWidth={1.5} />
                Add item
              </Button>
            ) : null}
            {subcategory.status === TaxonomyStatus.ACTIVE ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  openConfirm(`Deactivate “${subcategory.name}”?`, async () => {
                    await runMutation(
                      () => deactivateSubcategory(subcategory.id),
                      "Subcategory deactivated.",
                    );
                  })
                }
              >
                Deactivate
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void runMutation(
                    () => reactivateSubcategory(subcategory.id),
                    "Subcategory reactivated.",
                  )
                }
              >
                Reactivate
              </Button>
            )}
            {subcategory.prUsageCount === 0 && subcategory.catalogItemCount === 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  openConfirm(`Delete “${subcategory.name}”?`, async () => {
                    await runMutation(
                      () => deleteSubcategory(subcategory.id),
                      "Subcategory deleted.",
                    );
                  })
                }
              >
                Delete
              </Button>
            ) : null}
          </div>
          <SubcategoryFormDrawer
            open={editSubcategoryOpen}
            onOpenChange={setEditSubcategoryOpen}
            mode={{ kind: "edit", subcategory }}
            categories={categories}
            seriesOptions={seriesOptions}
            onSaved={onChanged}
          />
          <CatalogItemFormDrawer
            open={createItemOpen}
            onOpenChange={setCreateItemOpen}
            mode={{ kind: "create", defaultSubcategoryId: subcategory.id }}
            subcategories={[
              {
                id: subcategory.id,
                name: subcategory.name,
                categoryId: subcategory.categoryId,
                categoryName: subcategory.categoryName,
              },
            ]}
            onSaved={onChanged}
          />
        </SurfaceCard>
      ) : null}

      {node.type === "item" && catalogItem ? (
        <SurfaceCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SurfaceCardTitle>{catalogItem.name}</SurfaceCardTitle>
              <SurfaceCardDescription className="mt-1">
                {catalogItem.categoryName} → {catalogItem.subcategoryName}
              </SurfaceCardDescription>
            </div>
            <Chip
              tone={
                catalogItem.status === CatalogItemStatus.ACTIVE
                  ? "success"
                  : catalogItem.status === CatalogItemStatus.PENDING_APPROVAL
                    ? "warning"
                    : "neutral"
              }
              size="sm"
            >
              {catalogItem.status.replaceAll("_", " ").toLowerCase()}
            </Chip>
          </div>
          <dl className="grid gap-2 text-ds-sm sm:grid-cols-2">
            <div>
              <dt className="text-ds-xs text-muted-foreground">SKU</dt>
              <dd className="font-mono text-ds-xs">{catalogItem.sku ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Unit</dt>
              <dd>{catalogItem.unit}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">PR usage</dt>
              <dd className="tabular-nums">{catalogItem.usageCount}</dd>
            </div>
          </dl>
          <CatalogRowActions
            row={catalogItem}
            onEdit={() => setEditItemOpen(true)}
            onResolved={onChanged}
          />
          <CatalogItemFormDrawer
            open={editItemOpen}
            onOpenChange={setEditItemOpen}
            mode={{ kind: "edit", item: catalogItem }}
            subcategories={[
              {
                id: catalogItem.subcategoryId,
                name: catalogItem.subcategoryName,
                categoryId: catalogItem.categoryId,
                categoryName: catalogItem.categoryName,
              },
            ]}
            onSaved={onChanged}
          />
        </SurfaceCard>
      ) : null}

      {impact ? <TaxonomyImpactCard impact={impact} /> : null}

      {node.type === "subcategory" && catalogItems.length > 0 ? (
        <SurfaceCard
          header={
            <>
              <SurfaceCardTitle>Catalog items</SurfaceCardTitle>
              <SurfaceCardDescription>
                Items under this subcategory. Select one to manage details.
              </SurfaceCardDescription>
            </>
          }
        >
          <ul className="divide-y divide-border-subtle">
            {catalogItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left text-ds-sm hover:underline"
                  onClick={() => onSelectNode({ type: "item", id: item.id })}
                >
                  <span className="font-medium">{item.name}</span>
                  {item.sku ? (
                    <span className="ml-2 font-mono text-ds-xs text-muted-foreground">
                      {item.sku}
                    </span>
                  ) : null}
                </button>
                <Chip
                  tone={
                    item.status === CatalogItemStatus.PENDING_APPROVAL
                      ? "warning"
                      : item.status === CatalogItemStatus.ACTIVE
                        ? "success"
                        : "neutral"
                  }
                  size="sm"
                >
                  {item.status === CatalogItemStatus.PENDING_APPROVAL
                    ? "Pending"
                    : item.status === CatalogItemStatus.ACTIVE
                      ? "Active"
                      : "Inactive"}
                </Chip>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      ) : null}

      {isAdmin && node && impact ? (
        <TaxonomyAdminOverridePanel
          node={node}
          category={category}
          subcategory={subcategory}
          catalogItem={catalogItem}
          impact={impact}
          categories={categories}
          subcategories={subcategories}
          seriesOptions={seriesOptions}
          onChanged={onChanged}
        />
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        confirmLabel="Confirm"
        confirmVariant="destructive"
        closeOnConfirm={false}
        pending={busy}
        onConfirm={() => {
          if (confirmAction) void confirmAction();
        }}
      />
    </div>
  );
}
