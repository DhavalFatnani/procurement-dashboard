"use client";

import { FolderTree, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { CategoryFormDrawer } from "@/components/admin/CategoryFormDrawer";
import { SubcategoryFormDrawer } from "@/components/admin/SubcategoryFormDrawer";
import type { SeriesOption } from "@/components/admin/SubcategoryFormDrawer";
import { TaxonomyNodeDetail } from "@/components/admin/taxonomy/TaxonomyNodeDetail";
import { TaxonomyTree } from "@/components/admin/taxonomy/TaxonomyTree";
import { formatNodeParam, parseNodeParam, type TaxonomyNodeRef } from "@/lib/taxonomy-node";
import { Chip } from "@/components/shared/Chip";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import type { CatalogItemListRow } from "@/lib/queries/catalog";
import type { TaxonomyImpact } from "@/lib/queries/taxonomy-impact";
import type {
  CategoryListRow,
  SubcategoryListRow,
  TaxonomyCategoryOption,
  TaxonomySubcategoryOption,
  TaxonomyTreeCategory,
} from "@/lib/queries/taxonomy";

export function TaxonomyConsole({
  tree,
  pendingCount,
  selectedNode,
  category,
  subcategory,
  catalogItem,
  catalogItems,
  impact,
  isAdmin,
  categories,
  subcategories,
  seriesOptions,
}: {
  tree: TaxonomyTreeCategory[];
  pendingCount: number;
  selectedNode: TaxonomyNodeRef | null;
  category: CategoryListRow | null;
  subcategory: SubcategoryListRow | null;
  catalogItem: CatalogItemListRow | null;
  catalogItems: CatalogItemListRow[];
  impact: TaxonomyImpact | null;
  isAdmin: boolean;
  categories: TaxonomyCategoryOption[];
  subcategories: TaxonomySubcategoryOption[];
  seriesOptions: SeriesOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createCategoryOpen, setCreateCategoryOpen] = React.useState(false);
  const [createSubcategoryOpen, setCreateSubcategoryOpen] = React.useState(false);

  const parsedNode = parseNodeParam(searchParams.get("node")) ?? selectedNode;

  function navigate(node: TaxonomyNodeRef | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    params.delete("page");
    if (node) params.set("node", formatNodeParam(node));
    else params.delete("node");
    const qs = params.toString();
    router.replace(qs ? `/admin/taxonomy?${qs}` : "/admin/taxonomy", { scroll: false });
  }

  function refresh() {
    router.refresh();
  }

  const defaultCategoryId =
    parsedNode?.type === "category"
      ? parsedNode.id
      : parsedNode?.type === "subcategory"
        ? subcategory?.categoryId
        : catalogItem?.categoryId;

  const createSubcategoryMode = React.useMemo(
    () => ({
      kind: "create" as const,
      defaultCategoryId: defaultCategoryId ?? categories[0]?.id,
    }),
    [defaultCategoryId, categories],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxonomy"
        subtitle="Hierarchy-first console for categories, subcategories, and catalog items."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 ? (
              <Chip tone="warning" size="sm">
                {pendingCount} pending approval
              </Chip>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateCategoryOpen(true)}>
              <Plus className="size-4" strokeWidth={1.5} />
              Category
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!defaultCategoryId}
              onClick={() => setCreateSubcategoryOpen(true)}
            >
              <Plus className="size-4" strokeWidth={1.5} />
              Subcategory
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <TaxonomyTree
          categories={tree}
          selected={parsedNode}
          onSelect={(node) => navigate(node)}
        />
        <div className="min-w-0">
          {!parsedNode ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center rounded-lg border border-dashed border-border-subtle p-8 text-center">
              <FolderTree className="size-10 text-muted-foreground" strokeWidth={1.25} />
              <p className="mt-3 text-ds-sm text-muted-foreground">
                Select a node from the tree to inspect impact and run actions.
              </p>
            </div>
          ) : (
            <TaxonomyNodeDetail
              node={parsedNode}
              category={category}
              subcategory={subcategory}
              catalogItem={catalogItem}
              catalogItems={catalogItems}
              impact={impact}
              isAdmin={isAdmin}
              categories={categories}
              subcategories={subcategories}
              seriesOptions={seriesOptions}
              onChanged={refresh}
              onSelectNode={(node) => navigate(node)}
            />
          )}
        </div>
      </div>

      <CategoryFormDrawer
        open={createCategoryOpen}
        onOpenChange={setCreateCategoryOpen}
        mode={{ kind: "create" }}
        onSaved={() => {
          refresh();
          setCreateCategoryOpen(false);
        }}
      />

      <SubcategoryFormDrawer
        open={createSubcategoryOpen}
        onOpenChange={setCreateSubcategoryOpen}
        mode={createSubcategoryMode}
        categories={categories}
        seriesOptions={seriesOptions}
        onSaved={() => {
          refresh();
          setCreateSubcategoryOpen(false);
        }}
      />
    </div>
  );
}
