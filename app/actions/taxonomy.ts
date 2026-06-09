"use server";

import {
  CatalogItemStatus,
  CategoryBillingGranularity,
  ExecutionType,
  PRStatus,
  TaxonomyStatus,
} from "@/lib/prisma-enums";

import type { MutationResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { revalidateTaxonomyCache } from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";
import { OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";

const OPEN_PR_STATUSES: PRStatus[] = [
  PRStatus.DRAFT,
  PRStatus.PENDING_APPROVAL,
  PRStatus.APPROVED,
  PRStatus.REVISION_REQUIRED,
];

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

async function categoryPrUsageCount(categoryId: string): Promise<number> {
  return prisma.purchaseRequestLine.count({ where: { categoryId } });
}

async function subcategoryUsageCounts(subcategoryId: string) {
  const [prLines, catalogItems, reservations] = await Promise.all([
    prisma.purchaseRequestLine.count({ where: { subcategoryId } }),
    prisma.catalogItem.count({ where: { subcategoryId } }),
    prisma.serialReservation.count({
      where: { pr: { OR: [{ subcategoryId }, { lines: { some: { subcategoryId } } }] } },
    }),
  ]);
  return { prLines, catalogItems, reservations };
}

async function openPrCountForCategory(categoryId: string): Promise<number> {
  return prisma.purchaseRequest.count({
    where: {
      status: { in: OPEN_PR_STATUSES },
      OR: [{ categoryId }, { lines: { some: { categoryId } } }],
    },
  });
}

async function openPrCountForSubcategory(subcategoryId: string): Promise<number> {
  return prisma.purchaseRequest.count({
    where: {
      status: { in: OPEN_PR_STATUSES },
      OR: [{ subcategoryId }, { lines: { some: { subcategoryId } } }],
    },
  });
}

export async function createCategory(data: {
  name: string;
  billingGranularity: CategoryBillingGranularity;
}): Promise<MutationResult & { id?: string }> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const name = normalizeName(data.name);
  if (name.length < 2) {
    return { ok: false, message: "Category name must be at least 2 characters." };
  }

  try {
    const created = await prisma.category.create({
      data: {
        name,
        billingGranularity: data.billingGranularity,
        status: TaxonomyStatus.ACTIVE,
      },
    });
    revalidateTaxonomyCache();
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, message: "A category with this name already exists." };
  }
}

export async function updateCategory(
  id: string,
  data: { name: string; billingGranularity: CategoryBillingGranularity },
): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, message: "Category not found." };
  }

  const name = normalizeName(data.name);
  if (name.length < 2) {
    return { ok: false, message: "Category name must be at least 2 characters." };
  }

  if (data.billingGranularity !== existing.billingGranularity) {
    const usage = await categoryPrUsageCount(id);
    if (usage > 0) {
      return {
        ok: false,
        message: "Billing granularity cannot change after purchase requests reference this category.",
      };
    }
  }

  try {
    await prisma.category.update({
      where: { id },
      data: { name, billingGranularity: data.billingGranularity },
    });
  } catch {
    return { ok: false, message: "A category with this name already exists." };
  }

  revalidateTaxonomyCache();
  return { ok: true };
}

export async function deactivateCategory(id: string): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const existing = await prisma.category.findUnique({
    where: { id },
    include: { subcategories: { where: { status: TaxonomyStatus.ACTIVE } } },
  });
  if (!existing) {
    return { ok: false, message: "Category not found." };
  }
  if (existing.status === TaxonomyStatus.INACTIVE) {
    return { ok: false, message: "Category is already inactive." };
  }
  if (existing.subcategories.length > 0) {
    return {
      ok: false,
      message: "Deactivate all subcategories in this category first.",
    };
  }
  const openPrs = await openPrCountForCategory(id);
  if (openPrs > 0) {
    return {
      ok: false,
      message: "Category is referenced by open purchase requests.",
    };
  }

  await prisma.category.update({
    where: { id },
    data: { status: TaxonomyStatus.INACTIVE },
  });
  revalidateTaxonomyCache();
  return { ok: true };
}

export async function reactivateCategory(id: string): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, message: "Category not found." };
  }
  if (existing.status === TaxonomyStatus.ACTIVE) {
    return { ok: false, message: "Category is already active." };
  }

  await prisma.category.update({
    where: { id },
    data: { status: TaxonomyStatus.ACTIVE },
  });
  revalidateTaxonomyCache();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { subcategories: true } } },
  });
  if (!existing) {
    return { ok: false, message: "Category not found." };
  }
  if (existing._count.subcategories > 0) {
    return {
      ok: false,
      message: "Remove all subcategories before deleting this category.",
    };
  }
  const usage = await categoryPrUsageCount(id);
  if (usage > 0) {
    return {
      ok: false,
      message: "Category has purchase history. Deactivate instead of deleting.",
    };
  }

  await prisma.category.delete({ where: { id } });
  revalidateTaxonomyCache();
  return { ok: true };
}

export async function createSubcategory(data: {
  categoryId: string;
  name: string;
  executionType: ExecutionType;
  series?: string | null;
}): Promise<MutationResult & { id?: string }> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) {
    return { ok: false, message: "Category not found." };
  }
  if (category.status === TaxonomyStatus.INACTIVE) {
    return { ok: false, message: "Reactivate the parent category first." };
  }

  const name = normalizeName(data.name);
  if (name.length < 2) {
    return { ok: false, message: "Subcategory name must be at least 2 characters." };
  }

  const series = data.series?.trim() || null;
  if (data.executionType === ExecutionType.INTERNAL_PRINT) {
    if (!series) {
      return { ok: false, message: "Internal print subcategories require a serial series." };
    }
    const seriesRow = await prisma.seriesConfig.findFirst({
      where: { code: series, isActive: true },
    });
    if (!seriesRow) {
      return { ok: false, message: "Selected serial series is not active." };
    }
  } else if (series) {
    return { ok: false, message: "Vendor purchase subcategories cannot link a serial series." };
  }

  try {
    const created = await prisma.subcategory.create({
      data: {
        categoryId: data.categoryId,
        name,
        executionType: data.executionType,
        series: data.executionType === ExecutionType.INTERNAL_PRINT ? series : null,
        status: TaxonomyStatus.ACTIVE,
      },
    });
    revalidateTaxonomyCache();
    return { ok: true, id: created.id };
  } catch {
    return {
      ok: false,
      message: "A subcategory with this name already exists under the category.",
    };
  }
}

export async function updateSubcategory(
  id: string,
  data: {
    name: string;
    executionType: ExecutionType;
    series?: string | null;
  },
): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const existing = await prisma.subcategory.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, message: "Subcategory not found." };
  }

  const name = normalizeName(data.name);
  if (name.length < 2) {
    return { ok: false, message: "Subcategory name must be at least 2 characters." };
  }

  const series = data.series?.trim() || null;
  const executionChanged = data.executionType !== existing.executionType;
  const seriesChanged = series !== existing.series;

  if (executionChanged || seriesChanged) {
    const usage = await subcategoryUsageCounts(id);
    if (usage.prLines > 0 || usage.reservations > 0) {
      return {
        ok: false,
        message: "Execution type and series cannot change after purchase or serial use.",
      };
    }
  }

  if (data.executionType === ExecutionType.INTERNAL_PRINT) {
    if (!series) {
      return { ok: false, message: "Internal print subcategories require a serial series." };
    }
    const seriesRow = await prisma.seriesConfig.findFirst({
      where: { code: series, isActive: true },
    });
    if (!seriesRow) {
      return { ok: false, message: "Selected serial series is not active." };
    }
  } else if (series) {
    return { ok: false, message: "Vendor purchase subcategories cannot link a serial series." };
  }

  try {
    await prisma.subcategory.update({
      where: { id },
      data: {
        name,
        executionType: data.executionType,
        series: data.executionType === ExecutionType.INTERNAL_PRINT ? series : null,
      },
    });
  } catch {
    return {
      ok: false,
      message: "A subcategory with this name already exists under the category.",
    };
  }

  revalidateTaxonomyCache();
  return { ok: true };
}

export async function deactivateSubcategory(id: string): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const existing = await prisma.subcategory.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, message: "Subcategory not found." };
  }
  if (existing.status === TaxonomyStatus.INACTIVE) {
    return { ok: false, message: "Subcategory is already inactive." };
  }

  const activeItems = await prisma.catalogItem.count({
    where: { subcategoryId: id, status: { not: CatalogItemStatus.INACTIVE } },
  });
  if (activeItems > 0) {
    return {
      ok: false,
      message: "Deactivate catalog items under this subcategory first.",
    };
  }

  const openPrs = await openPrCountForSubcategory(id);
  if (openPrs > 0) {
    return {
      ok: false,
      message: "Subcategory is referenced by open purchase requests.",
    };
  }

  await prisma.subcategory.update({
    where: { id },
    data: { status: TaxonomyStatus.INACTIVE },
  });
  revalidateTaxonomyCache();
  return { ok: true };
}

export async function reactivateSubcategory(id: string): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const existing = await prisma.subcategory.findUnique({
    where: { id },
    include: { category: { select: { status: true } } },
  });
  if (!existing) {
    return { ok: false, message: "Subcategory not found." };
  }
  if (existing.category.status === TaxonomyStatus.INACTIVE) {
    return { ok: false, message: "Reactivate the parent category first." };
  }
  if (existing.status === TaxonomyStatus.ACTIVE) {
    return { ok: false, message: "Subcategory is already active." };
  }

  await prisma.subcategory.update({
    where: { id },
    data: { status: TaxonomyStatus.ACTIVE },
  });
  revalidateTaxonomyCache();
  return { ok: true };
}

export async function deleteSubcategory(id: string): Promise<MutationResult> {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);

  const usage = await subcategoryUsageCounts(id);
  if (usage.catalogItems > 0 || usage.prLines > 0 || usage.reservations > 0) {
    return {
      ok: false,
      message: "Subcategory has catalog items or procurement history. Deactivate instead.",
    };
  }

  try {
    await prisma.subcategory.delete({ where: { id } });
  } catch {
    return { ok: false, message: "Subcategory not found." };
  }

  revalidateTaxonomyCache();
  return { ok: true };
}
