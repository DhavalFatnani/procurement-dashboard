import { cache } from "react";

import {
  CatalogItemKind,
  CatalogItemStatus,
  ExecutionType,
  type Prisma,
} from "@/lib/prisma-client";

import { getCachedCategories } from "@/lib/cache";
import { CategoryBillingGranularity } from "@/lib/prisma-enums";
import { cachedQuery, LIST_CACHE_TAGS, stableFilterKey } from "@/lib/list-cache";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export type CatalogItemFilters = {
  search?: string;
  status?: CatalogItemStatus;
  categoryId?: string;
  subcategoryId?: string;
  /** When true, only disputed settlement variants. */
  disputedVariantsOnly?: boolean;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

export type CatalogItemListRow = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  kind: CatalogItemKind;
  baseCatalogItemId: string | null;
  status: CatalogItemStatus;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  createdByName: string;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  usageCount: number;
};

export type CatalogSubcategoryOption = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
};

export const getCatalogFilterOptions = cache(async (): Promise<{
  categories: { id: string; name: string }[];
  subcategories: CatalogSubcategoryOption[];
}> => {
  const categoriesWithSubs = await getCachedCategories();
  const vendorSubs = categoriesWithSubs
    .filter((c) => c.billingGranularity === CategoryBillingGranularity.CATALOG_ITEM)
    .flatMap((c) =>
      c.subcategories
        .filter((s) => s.executionType === ExecutionType.VENDOR_PURCHASE)
        .map((s) => ({
          id: s.id,
          name: s.name,
          categoryId: c.id,
          categoryName: c.name,
        })),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const categoryIds = new Set(vendorSubs.map((s) => s.categoryId));
  const categories = categoriesWithSubs
    .filter((c) => categoryIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { categories, subcategories: vendorSubs };
});

export async function getCatalogItems(
  filters: CatalogItemFilters,
): Promise<Paginated<CatalogItemListRow>> {
  const filterKey = stableFilterKey({ ...filters });
  return cachedQuery(
    LIST_CACHE_TAGS.catalog,
    [filterKey],
    () => fetchCatalogItems(filters),
    { tags: [LIST_CACHE_TAGS.catalog, "catalog-items"] },
  );
}

async function fetchCatalogItems(
  filters: CatalogItemFilters,
): Promise<Paginated<CatalogItemListRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const clauses: Prisma.CatalogItemWhereInput[] = [
    {
      subcategory: { executionType: ExecutionType.VENDOR_PURCHASE },
    },
  ];

  if (filters.status) {
    clauses.push({ status: filters.status });
  }
  if (filters.subcategoryId) {
    clauses.push({ subcategoryId: filters.subcategoryId });
  } else if (filters.categoryId) {
    clauses.push({ subcategory: { categoryId: filters.categoryId } });
  }
  if (filters.disputedVariantsOnly) {
    clauses.push({ kind: CatalogItemKind.DISPUTED });
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    clauses.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.CatalogItemWhereInput =
    clauses.length > 0 ? { AND: clauses } : {};

  const paginated = await paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount ?? false,
    count: () => prisma.catalogItem.count({ where }),
    findMany: ({ skip, take }) =>
      prisma.catalogItem.findMany({
        where,
        orderBy: [
          { status: "asc" },
          { subcategory: { category: { name: "asc" } } },
          { subcategory: { name: "asc" } },
          { name: "asc" },
        ],
        skip,
        take,
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          kind: true,
          baseCatalogItemId: true,
          status: true,
          approvedAt: true,
          rejectedReason: true,
          createdAt: true,
          subcategory: {
            select: {
              id: true,
              name: true,
              categoryId: true,
              category: { select: { name: true } },
            },
          },
          createdBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
          _count: { select: { prLineItems: true } },
        },
      }),
  });

  return {
    ...paginated,
    items: paginated.items.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      unit: row.unit,
      kind: row.kind,
      baseCatalogItemId: row.baseCatalogItemId,
      status: row.status,
      categoryId: row.subcategory.categoryId,
      categoryName: row.subcategory.category.name,
      subcategoryId: row.subcategory.id,
      subcategoryName: row.subcategory.name,
      createdByName: row.createdBy.name,
      approvedByName: row.approvedBy?.name ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedReason: row.rejectedReason,
      createdAt: row.createdAt.toISOString(),
      usageCount: row._count.prLineItems,
    })),
  };
}

export async function getCatalogItemById(
  id: string,
): Promise<CatalogItemListRow | null> {
  const row = await prisma.catalogItem.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      kind: true,
      baseCatalogItemId: true,
      status: true,
      approvedAt: true,
      rejectedReason: true,
      createdAt: true,
      subcategory: {
        select: {
          id: true,
          name: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      _count: { select: { prLineItems: true } },
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    kind: row.kind,
    baseCatalogItemId: row.baseCatalogItemId,
    status: row.status,
    categoryId: row.subcategory.categoryId,
    categoryName: row.subcategory.category.name,
    subcategoryId: row.subcategory.id,
    subcategoryName: row.subcategory.name,
    createdByName: row.createdBy.name,
    approvedByName: row.approvedBy?.name ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedReason: row.rejectedReason,
    createdAt: row.createdAt.toISOString(),
    usageCount: row._count.prLineItems,
  };
}
