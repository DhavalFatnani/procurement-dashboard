import { CatalogItemStatus, TaxonomyStatus } from "@/lib/prisma-enums";

import { TaxonomyView } from "@/components/admin/TaxonomyView";
import { getCachedSeriesDefinitions } from "@/lib/cache";
import { dbParallel } from "@/lib/db-parallel";
import { getCatalogFilterOptions, getCatalogItems } from "@/lib/queries/catalog";
import { prisma } from "@/lib/prisma";
import {
  getCategories,
  getSubcategories,
  getTaxonomyCategoryOptions,
} from "@/lib/queries/taxonomy";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export const dynamic = "force-dynamic";

export default async function AdminTaxonomyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  assertRole(await getRequestSession(), [...ACCESS.admin]);
  const sp = await searchParams;
  const tab = str(sp.tab) || "categories";
  const search = str(sp.q);
  const statusRaw = str(sp.status);
  const categoryId = str(sp.categoryId);
  const subcategoryId = str(sp.subcategoryId);
  const disputedVariantsOnly = str(sp.disputed) === "1";
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const includeExactCount = str(sp.exactCount) === "1" || page === 1;

  const catalogStatus =
    statusRaw && statusRaw in CatalogItemStatus
      ? (statusRaw as CatalogItemStatus)
      : undefined;

  const taxonomyStatus =
    statusRaw && statusRaw in TaxonomyStatus ? (statusRaw as TaxonomyStatus) : undefined;

  const [
    taxonomyCategories,
    seriesDefinitions,
    categoriesRows,
    subcategoriesRows,
    catalogFilterOptions,
    catalogRows,
    pendingCount,
  ] = await dbParallel(
    () => getTaxonomyCategoryOptions(),
    () => getCachedSeriesDefinitions(),
    () =>
      getCategories({
        search: tab === "categories" ? search || undefined : undefined,
        status: tab === "categories" ? taxonomyStatus : undefined,
        page: tab === "categories" ? page : 1,
        includeExactCount: tab === "categories" ? includeExactCount : false,
      }),
    () =>
      getSubcategories({
        search: tab === "subcategories" ? search || undefined : undefined,
        status: tab === "subcategories" ? taxonomyStatus : undefined,
        categoryId: tab === "subcategories" ? categoryId || undefined : undefined,
        page: tab === "subcategories" ? page : 1,
        includeExactCount: tab === "subcategories" ? includeExactCount : false,
      }),
    () => getCatalogFilterOptions(),
    () =>
      getCatalogItems({
        search: tab === "items" ? search || undefined : undefined,
        status: tab === "items" ? catalogStatus : undefined,
        categoryId: tab === "items" ? categoryId || undefined : undefined,
        subcategoryId: tab === "items" ? subcategoryId || undefined : undefined,
        disputedVariantsOnly: tab === "items" ? disputedVariantsOnly || undefined : undefined,
        page: tab === "items" ? page : 1,
        includeExactCount: tab === "items" ? includeExactCount : false,
      }),
    () =>
      prisma.catalogItem.count({
        where: { status: CatalogItemStatus.PENDING_APPROVAL },
      }),
  );

  const seriesOptions = seriesDefinitions
    .filter((s) => s.isActive)
    .map((s) => ({ code: s.code, label: s.displayName }));

  return (
    <TaxonomyView
      categoriesRows={categoriesRows}
      subcategoriesRows={subcategoriesRows}
      catalogRows={catalogRows}
      pendingCount={pendingCount}
      taxonomyCategories={taxonomyCategories}
      seriesOptions={seriesOptions}
      categoryFilters={{ search: tab === "categories" ? search : "", status: tab === "categories" ? statusRaw : "" }}
      subcategoryFilters={{
        search: tab === "subcategories" ? search : "",
        status: tab === "subcategories" ? statusRaw : "",
        categoryId: tab === "subcategories" ? categoryId : "",
      }}
      catalogFilters={{
        search: tab === "items" ? search : "",
        status: tab === "items" ? statusRaw : "",
        categoryId: tab === "items" ? categoryId : "",
        subcategoryId: tab === "items" ? subcategoryId : "",
        disputedVariantsOnly: tab === "items" ? disputedVariantsOnly : false,
      }}
      catalogFilterOptions={catalogFilterOptions}
    />
  );
}
