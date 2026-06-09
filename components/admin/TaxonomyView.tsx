"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { CatalogView } from "@/components/admin/CatalogView";
import { CategoriesView } from "@/components/admin/CategoriesView";
import { SubcategoriesView } from "@/components/admin/SubcategoriesView";
import type { SeriesOption } from "@/components/admin/SubcategoryFormDrawer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/Tabs";
import type { CatalogItemListRow, CatalogSubcategoryOption } from "@/lib/queries/catalog";
import type {
  CategoryListRow,
  SubcategoryListRow,
  TaxonomyCategoryOption,
} from "@/lib/queries/taxonomy";
import type { Paginated } from "@/lib/pagination";

type TabId = "categories" | "subcategories" | "items";

function parseTab(value: string | null): TabId {
  if (value === "categories" || value === "subcategories" || value === "items") {
    return value;
  }
  return "categories";
}

export function TaxonomyView({
  categoriesRows,
  subcategoriesRows,
  catalogRows,
  pendingCount,
  categoryFilters,
  subcategoryFilters,
  catalogFilters,
  catalogFilterOptions,
  taxonomyCategories,
  seriesOptions,
}: {
  categoriesRows: Paginated<CategoryListRow>;
  subcategoriesRows: Paginated<SubcategoryListRow>;
  catalogRows: Paginated<CatalogItemListRow>;
  pendingCount: number;
  categoryFilters: { search: string; status: string };
  subcategoryFilters: { search: string; status: string; categoryId: string };
  catalogFilters: {
    search: string;
    status: string;
    categoryId: string;
    subcategoryId: string;
    disputedVariantsOnly: boolean;
  };
  catalogFilterOptions: {
    categories: { id: string; name: string }[];
    subcategories: CatalogSubcategoryOption[];
  };
  taxonomyCategories: TaxonomyCategoryOption[];
  seriesOptions: SeriesOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));

  function setTab(tab: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `/admin/taxonomy?${qs}` : "/admin/taxonomy", { scroll: false });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxonomy"
        subtitle="Manage categories, subcategories, and catalog items that drive purchase request structure."
      />

      <Tabs value={activeTab} onValueChange={(v) => setTab(parseTab(v))}>
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="subcategories">Subcategories</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <CategoriesView initialRows={categoriesRows} filters={categoryFilters} />
        </TabsContent>

        <TabsContent value="subcategories">
          <SubcategoriesView
            initialRows={subcategoriesRows}
            filters={subcategoryFilters}
            categories={taxonomyCategories}
            seriesOptions={seriesOptions}
          />
        </TabsContent>

        <TabsContent value="items">
          <CatalogView
            initialRows={catalogRows}
            pendingCount={pendingCount}
            filters={catalogFilters}
            filterOptions={catalogFilterOptions}
            embedded
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
