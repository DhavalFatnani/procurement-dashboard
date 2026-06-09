import {
  CategoryBillingGranularity,
  ExecutionType,
  Prisma,
  TaxonomyStatus,
} from "@/lib/prisma-client";

import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export type CategoryListRow = {
  id: string;
  name: string;
  billingGranularity: CategoryBillingGranularity;
  status: TaxonomyStatus;
  subcategoryCount: number;
  prUsageCount: number;
};

export type SubcategoryListRow = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  executionType: ExecutionType;
  series: string | null;
  seriesLabel: string | null;
  status: TaxonomyStatus;
  catalogItemCount: number;
  prUsageCount: number;
};

export type CategoryFilters = {
  search?: string;
  status?: TaxonomyStatus;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

export type SubcategoryFilters = {
  search?: string;
  categoryId?: string;
  status?: TaxonomyStatus;
  executionType?: ExecutionType;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

export type TaxonomyCategoryOption = {
  id: string;
  name: string;
  billingGranularity: CategoryBillingGranularity;
  status: TaxonomyStatus;
};

export type TaxonomySubcategoryOption = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  executionType: ExecutionType;
  series: string | null;
  status: TaxonomyStatus;
};

export async function getTaxonomyCategoryOptions(): Promise<TaxonomyCategoryOption[]> {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      billingGranularity: true,
      status: true,
    },
  });
  return rows;
}

export async function getTaxonomySubcategoryOptions(): Promise<TaxonomySubcategoryOption[]> {
  const rows = await prisma.subcategory.findMany({
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      categoryId: true,
      executionType: true,
      series: true,
      status: true,
      category: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    executionType: r.executionType,
    series: r.series,
    status: r.status,
  }));
}

export async function getCategories(
  filters: CategoryFilters,
): Promise<Paginated<CategoryListRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const clauses: Prisma.CategoryWhereInput[] = [];
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    clauses.push({ name: { contains: q, mode: "insensitive" } });
  }
  if (filters.status) {
    clauses.push({ status: filters.status });
  }
  const where: Prisma.CategoryWhereInput =
    clauses.length > 0 ? { AND: clauses } : {};

  return paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount,
    findMany: async ({ skip, take }) => {
      const rows = await prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          billingGranularity: true,
          status: true,
          _count: {
            select: {
              subcategories: true,
              purchaseRequestLines: true,
            },
          },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        billingGranularity: r.billingGranularity,
        status: r.status,
        subcategoryCount: r._count.subcategories,
        prUsageCount: r._count.purchaseRequestLines,
      }));
    },
    count: () => prisma.category.count({ where }),
  });
}

export async function getSubcategories(
  filters: SubcategoryFilters,
): Promise<Paginated<SubcategoryListRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const clauses: Prisma.SubcategoryWhereInput[] = [];
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    clauses.push({ name: { contains: q, mode: "insensitive" } });
  }
  if (filters.categoryId) {
    clauses.push({ categoryId: filters.categoryId });
  }
  if (filters.status) {
    clauses.push({ status: filters.status });
  }
  if (filters.executionType) {
    clauses.push({ executionType: filters.executionType });
  }
  const where: Prisma.SubcategoryWhereInput =
    clauses.length > 0 ? { AND: clauses } : {};

  return paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount,
    findMany: async ({ skip, take }) => {
      const rows = await prisma.subcategory.findMany({
        where,
        skip,
        take,
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          categoryId: true,
          executionType: true,
          series: true,
          status: true,
          category: { select: { name: true } },
          seriesConfig: { select: { displayName: true } },
          _count: {
            select: {
              catalogItems: true,
              purchaseRequestLines: true,
            },
          },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        categoryId: r.categoryId,
        categoryName: r.category.name,
        executionType: r.executionType,
        series: r.series,
        seriesLabel: r.seriesConfig?.displayName ?? r.series,
        status: r.status,
        catalogItemCount: r._count.catalogItems,
        prUsageCount: r._count.purchaseRequestLines,
      }));
    },
    count: () => prisma.subcategory.count({ where }),
  });
}
