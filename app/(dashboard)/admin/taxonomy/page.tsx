import { redirect } from "next/navigation";

import { TaxonomyConsole } from "@/components/admin/taxonomy/TaxonomyConsole";
import { parseNodeParam } from "@/lib/taxonomy-node";
import { getCachedSeriesDefinitions } from "@/lib/cache";
import { dbParallel } from "@/lib/db-parallel";
import { isAdminRole } from "@/lib/admin-access";
import { getCatalogItemById, getCatalogItems } from "@/lib/queries/catalog";
import {
  getCategoryDetail,
  getSubcategoryDetail,
  getTaxonomyCategoryOptions,
  getTaxonomySubcategoryOptions,
  getTaxonomyTree,
} from "@/lib/queries/taxonomy";
import {
  getCatalogItemImpact,
  getCategoryImpact,
  getSubcategoryImpact,
} from "@/lib/queries/taxonomy-impact";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export const dynamic = "force-dynamic";

function legacyNodeFromTab(sp: Record<string, string | string[] | undefined>): string | null {
  const tab = str(sp.tab);
  if (!tab) return null;

  const categoryId = str(sp.categoryId);
  const subcategoryId = str(sp.subcategoryId);
  const itemId = str(sp.id) || str(sp.catalogItemId);

  if (tab === "items" && itemId) return `item:${itemId}`;
  if (tab === "items" && subcategoryId) return `subcategory:${subcategoryId}`;
  if (tab === "subcategories" && subcategoryId) return `subcategory:${subcategoryId}`;
  if (tab === "subcategories" && categoryId) return `category:${categoryId}`;
  if (tab === "categories" && categoryId) return `category:${categoryId}`;
  if (tab === "items") return null;
  if (tab === "subcategories") return null;
  return null;
}

export default async function AdminTaxonomyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getRequestSession();
  assertRole(session, [...ACCESS.admin]);
  const sp = await searchParams;

  const legacyNode = legacyNodeFromTab(sp);
  const nodeParam = str(sp.node) || legacyNode;
  if (str(sp.tab) && !str(sp.node)) {
    const params = new URLSearchParams();
    if (nodeParam) params.set("node", nodeParam);
    if (str(sp.pending) === "1") params.set("pending", "1");
    const q = str(sp.q);
    if (q) params.set("q", q);
    redirect(`/admin/taxonomy?${params.toString()}`);
  }

  const selectedNode = parseNodeParam(nodeParam);

  const [
    { categories: tree, pendingCount },
    seriesDefinitions,
    taxonomyCategories,
    taxonomySubcategories,
  ] = await dbParallel(
    () => getTaxonomyTree(),
    () => getCachedSeriesDefinitions(),
    () => getTaxonomyCategoryOptions(),
    () => getTaxonomySubcategoryOptions(),
  );

  const seriesOptions = seriesDefinitions
    .filter((s) => s.isActive)
    .map((s) => ({ code: s.code, label: s.displayName }));

  let category = null;
  let subcategory = null;
  let catalogItem = null;
  let catalogItems: Awaited<ReturnType<typeof getCatalogItems>>["items"] = [];
  let impact = null;

  if (selectedNode?.type === "category") {
    [category, impact] = await dbParallel(
      () => getCategoryDetail(selectedNode.id),
      () => getCategoryImpact(selectedNode.id),
    );
  } else if (selectedNode?.type === "subcategory") {
    const [subcategoryRow, subImpact, catalogPage] = await dbParallel(
      () => getSubcategoryDetail(selectedNode.id),
      () => getSubcategoryImpact(selectedNode.id),
      () =>
        getCatalogItems({
          subcategoryId: selectedNode.id,
          page: 1,
          pageSize: 50,
        }),
    );
    subcategory = subcategoryRow;
    impact = subImpact;
    catalogItems = catalogPage.items;
  } else if (selectedNode?.type === "item") {
    catalogItem = await getCatalogItemById(selectedNode.id);
    if (catalogItem) {
      [impact, subcategory] = await dbParallel(
        () => getCatalogItemImpact(selectedNode.id),
        () => getSubcategoryDetail(catalogItem!.subcategoryId),
      );
    }
  }

  return (
    <TaxonomyConsole
      tree={tree}
      pendingCount={pendingCount}
      selectedNode={selectedNode}
      category={category}
      subcategory={subcategory}
      catalogItem={catalogItem}
      catalogItems={catalogItems}
      impact={impact}
      isAdmin={isAdminRole(session!.role)}
      categories={taxonomyCategories}
      subcategories={taxonomySubcategories}
      seriesOptions={seriesOptions}
    />
  );
}
