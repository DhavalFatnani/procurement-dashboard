"use server";

import { revalidatePath } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import { writeAdminAuditLog } from "@/lib/admin-audit";
import { ADMIN_ONLY_ROLES } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import {
  AdminAuditAction,
  CatalogItemStatus,
  CategoryBillingGranularity,
  ExecutionType,
  TaxonomyStatus,
} from "@/lib/prisma-enums";
import {
  getCategoryImpact,
  getSubcategoryImpact,
  getCatalogItemImpact,
} from "@/lib/queries/taxonomy-impact";
import { revalidateCatalogCache, revalidateTaxonomyCache } from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";

async function guardAdminOnly() {
  return requireRoles([...ADMIN_ONLY_ROLES]);
}

function requireReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "Reason is required.";
  return null;
}

function revalidateTaxonomyPaths() {
  revalidateTaxonomyCache();
  revalidateCatalogCache();
  revalidatePath("/admin/taxonomy");
  revalidatePath("/admin/platform");
}

async function inactivateCatalogItemsForSubcategories(
  subcategoryIds: string[],
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
) {
  if (subcategoryIds.length === 0) return 0;
  const result = await tx.catalogItem.updateMany({
    where: {
      subcategoryId: { in: subcategoryIds },
      status: { in: [CatalogItemStatus.ACTIVE, CatalogItemStatus.PENDING_APPROVAL] },
    },
    data: { status: CatalogItemStatus.INACTIVE },
  });
  return result.count;
}

export async function adminCascadeDeactivateCategory(
  categoryId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(reason);
  if (reasonError) return { ok: false, message: reasonError };

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { subcategories: { select: { id: true } } },
  });
  if (!category) return { ok: false, message: "Category not found." };
  if (category.status === TaxonomyStatus.INACTIVE) {
    return { ok: false, message: "Category is already inactive." };
  }

  const impact = await getCategoryImpact(categoryId);
  if (!impact) return { ok: false, message: "Category not found." };
  if (impact.openPurchaseRequests > 0) {
    return {
      ok: false,
      message:
        "Category has open purchase requests. Use force deactivate to acknowledge and proceed.",
    };
  }

  const subcategoryIds = category.subcategories.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    const inactivatedItems = await inactivateCatalogItemsForSubcategories(subcategoryIds, tx);
    await tx.subcategory.updateMany({
      where: { categoryId },
      data: { status: TaxonomyStatus.INACTIVE },
    });
    await tx.category.update({
      where: { id: categoryId },
      data: { status: TaxonomyStatus.INACTIVE },
    });
    await writeAdminAuditLog(
      {
        actorId: user.id,
        action: AdminAuditAction.TAXONOMY_CASCADE_DEACTIVATE,
        targetType: "category",
        targetId: categoryId,
        reason,
        metadata: {
          subcategoryCount: subcategoryIds.length,
          inactivatedCatalogItems: inactivatedItems,
        },
      },
      tx,
    );
  });

  revalidateTaxonomyPaths();
  return { ok: true };
}

export async function adminCascadeDeactivateSubcategory(
  subcategoryId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(reason);
  if (reasonError) return { ok: false, message: reasonError };

  const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!subcategory) return { ok: false, message: "Subcategory not found." };
  if (subcategory.status === TaxonomyStatus.INACTIVE) {
    return { ok: false, message: "Subcategory is already inactive." };
  }

  const impact = await getSubcategoryImpact(subcategoryId);
  if (!impact) return { ok: false, message: "Subcategory not found." };
  if (impact.openPurchaseRequests > 0) {
    return {
      ok: false,
      message:
        "Subcategory has open purchase requests. Use force deactivate to acknowledge and proceed.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const inactivatedItems = await inactivateCatalogItemsForSubcategories([subcategoryId], tx);
    await tx.subcategory.update({
      where: { id: subcategoryId },
      data: { status: TaxonomyStatus.INACTIVE },
    });
    await writeAdminAuditLog(
      {
        actorId: user.id,
        action: AdminAuditAction.TAXONOMY_CASCADE_DEACTIVATE,
        targetType: "subcategory",
        targetId: subcategoryId,
        reason,
        metadata: { inactivatedCatalogItems: inactivatedItems },
      },
      tx,
    );
  });

  revalidateTaxonomyPaths();
  return { ok: true };
}

export async function adminForceDeactivateCategory(
  categoryId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(reason);
  if (reasonError) return { ok: false, message: reasonError };

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { subcategories: { select: { id: true } } },
  });
  if (!category) return { ok: false, message: "Category not found." };
  if (category.status === TaxonomyStatus.INACTIVE) {
    return { ok: false, message: "Category is already inactive." };
  }

  const impact = await getCategoryImpact(categoryId);
  if (!impact) return { ok: false, message: "Category not found." };

  const subcategoryIds = category.subcategories.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    const inactivatedItems = await inactivateCatalogItemsForSubcategories(subcategoryIds, tx);
    await tx.subcategory.updateMany({
      where: { categoryId },
      data: { status: TaxonomyStatus.INACTIVE },
    });
    await tx.category.update({
      where: { id: categoryId },
      data: { status: TaxonomyStatus.INACTIVE },
    });
    await writeAdminAuditLog(
      {
        actorId: user.id,
        action: AdminAuditAction.TAXONOMY_FORCE_DEACTIVATE,
        targetType: "category",
        targetId: categoryId,
        reason,
        metadata: {
          openPurchaseRequestIds: impact.openPurchaseRequestIds,
          subcategoryCount: subcategoryIds.length,
          inactivatedCatalogItems: inactivatedItems,
        },
      },
      tx,
    );
  });

  revalidateTaxonomyPaths();
  return { ok: true };
}

export async function adminForceDeactivateSubcategory(
  subcategoryId: string,
  reason: string,
): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(reason);
  if (reasonError) return { ok: false, message: reasonError };

  const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!subcategory) return { ok: false, message: "Subcategory not found." };
  if (subcategory.status === TaxonomyStatus.INACTIVE) {
    return { ok: false, message: "Subcategory is already inactive." };
  }

  const impact = await getSubcategoryImpact(subcategoryId);
  if (!impact) return { ok: false, message: "Subcategory not found." };

  await prisma.$transaction(async (tx) => {
    const inactivatedItems = await inactivateCatalogItemsForSubcategories([subcategoryId], tx);
    await tx.subcategory.update({
      where: { id: subcategoryId },
      data: { status: TaxonomyStatus.INACTIVE },
    });
    await writeAdminAuditLog(
      {
        actorId: user.id,
        action: AdminAuditAction.TAXONOMY_FORCE_DEACTIVATE,
        targetType: "subcategory",
        targetId: subcategoryId,
        reason,
        metadata: {
          openPurchaseRequestIds: impact.openPurchaseRequestIds,
          inactivatedCatalogItems: inactivatedItems,
        },
      },
      tx,
    );
  });

  revalidateTaxonomyPaths();
  return { ok: true };
}

export type AdminReassignGranularityResolution =
  | "align-target-to-source"
  | "align-source-to-target"
  | { categoryId: string; billingGranularity: CategoryBillingGranularity };

type GranularityAlignment = {
  categoryId: string;
  categoryName: string;
  from: CategoryBillingGranularity;
  to: CategoryBillingGranularity;
};

function resolveGranularityAlignment(input: {
  sourceCategory: { id: string; name: string; billingGranularity: CategoryBillingGranularity };
  targetCategory: { id: string; name: string; billingGranularity: CategoryBillingGranularity };
  resolution?: AdminReassignGranularityResolution;
}): GranularityAlignment | null | { error: string } {
  const { sourceCategory, targetCategory, resolution } = input;
  if (sourceCategory.billingGranularity === targetCategory.billingGranularity) {
    return null;
  }
  if (!resolution) {
    return {
      error:
        "Parent and target categories use different billing granularity. Choose how to align before moving.",
    };
  }

  if (resolution === "align-target-to-source") {
    return {
      categoryId: targetCategory.id,
      categoryName: targetCategory.name,
      from: targetCategory.billingGranularity,
      to: sourceCategory.billingGranularity,
    };
  }
  if (resolution === "align-source-to-target") {
    return {
      categoryId: sourceCategory.id,
      categoryName: sourceCategory.name,
      from: sourceCategory.billingGranularity,
      to: targetCategory.billingGranularity,
    };
  }

  const explicitCategory =
    resolution.categoryId === sourceCategory.id
      ? sourceCategory
      : resolution.categoryId === targetCategory.id
        ? targetCategory
        : null;
  if (!explicitCategory) {
    return { error: "Granularity override must apply to the source or target category." };
  }
  if (explicitCategory.billingGranularity === resolution.billingGranularity) {
    return null;
  }
  return {
    categoryId: explicitCategory.id,
    categoryName: explicitCategory.name,
    from: explicitCategory.billingGranularity,
    to: resolution.billingGranularity,
  };
}

export async function adminReassignSubcategory(input: {
  subcategoryId: string;
  targetCategoryId: string;
  reason: string;
  granularityResolution?: AdminReassignGranularityResolution;
}): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(input.reason);
  if (reasonError) return { ok: false, message: reasonError };

  const subcategory = await prisma.subcategory.findUnique({
    where: { id: input.subcategoryId },
    include: { category: { select: { id: true, billingGranularity: true, name: true } } },
  });
  if (!subcategory) return { ok: false, message: "Subcategory not found." };

  const targetCategory = await prisma.category.findUnique({
    where: { id: input.targetCategoryId },
    select: { id: true, billingGranularity: true, name: true, status: true },
  });
  if (!targetCategory) return { ok: false, message: "Target category not found." };
  if (targetCategory.status === TaxonomyStatus.INACTIVE) {
    return { ok: false, message: "Target category must be active." };
  }
  if (targetCategory.id === subcategory.categoryId) {
    return { ok: false, message: "Subcategory is already under that category." };
  }

  const alignment = resolveGranularityAlignment({
    sourceCategory: subcategory.category,
    targetCategory,
    resolution: input.granularityResolution,
  });
  if (alignment && "error" in alignment) {
    return { ok: false, message: alignment.error };
  }

  await prisma.$transaction(async (tx) => {
    if (alignment) {
      await tx.category.update({
        where: { id: alignment.categoryId },
        data: { billingGranularity: alignment.to },
      });
      await writeAdminAuditLog(
        {
          actorId: user.id,
          action: AdminAuditAction.TAXONOMY_OVERRIDE_BILLING_GRANULARITY,
          targetType: "category",
          targetId: alignment.categoryId,
          reason: input.reason,
          metadata: {
            from: alignment.from,
            to: alignment.to,
            context: "reassign-subcategory",
            subcategoryId: input.subcategoryId,
            targetCategoryId: input.targetCategoryId,
            categoryName: alignment.categoryName,
          },
        },
        tx,
      );
    }

    await tx.subcategory.update({
      where: { id: input.subcategoryId },
      data: { categoryId: input.targetCategoryId },
    });
    await writeAdminAuditLog(
      {
        actorId: user.id,
        action: AdminAuditAction.TAXONOMY_REASSIGN_SUBCATEGORY,
        targetType: "subcategory",
        targetId: input.subcategoryId,
        reason: input.reason,
        metadata: {
          fromCategoryId: subcategory.categoryId,
          fromCategoryName: subcategory.category.name,
          fromBillingGranularity: subcategory.category.billingGranularity,
          toCategoryId: targetCategory.id,
          toCategoryName: targetCategory.name,
          toBillingGranularity: targetCategory.billingGranularity,
          granularityResolution: input.granularityResolution ?? null,
          granularityAligned: alignment
            ? { categoryId: alignment.categoryId, from: alignment.from, to: alignment.to }
            : null,
        },
      },
      tx,
    );
  });

  revalidateTaxonomyPaths();
  return { ok: true };
}

export async function adminOverrideBillingGranularity(input: {
  categoryId: string;
  billingGranularity: CategoryBillingGranularity;
  reason: string;
}): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(input.reason);
  if (reasonError) return { ok: false, message: reasonError };

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) return { ok: false, message: "Category not found." };
  if (category.billingGranularity === input.billingGranularity) {
    return { ok: false, message: "Billing granularity is unchanged." };
  }

  const impact = await getCategoryImpact(input.categoryId);
  if (!impact) return { ok: false, message: "Category not found." };

  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id: input.categoryId },
      data: { billingGranularity: input.billingGranularity },
    });
    await writeAdminAuditLog(
      {
        actorId: user.id,
        action: AdminAuditAction.TAXONOMY_OVERRIDE_BILLING_GRANULARITY,
        targetType: "category",
        targetId: input.categoryId,
        reason: input.reason,
        metadata: {
          from: category.billingGranularity,
          to: input.billingGranularity,
          purchaseRequestLineCount: impact.purchaseRequestLines,
        },
      },
      tx,
    );
  });

  revalidateTaxonomyPaths();
  return { ok: true };
}

export async function adminOverrideExecution(input: {
  subcategoryId: string;
  executionType: ExecutionType;
  series?: string | null;
  reason: string;
}): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(input.reason);
  if (reasonError) return { ok: false, message: reasonError };

  const subcategory = await prisma.subcategory.findUnique({ where: { id: input.subcategoryId } });
  if (!subcategory) return { ok: false, message: "Subcategory not found." };

  const series = input.series?.trim() || null;
  if (input.executionType === ExecutionType.INTERNAL_PRINT) {
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

  const impact = await getSubcategoryImpact(input.subcategoryId);
  if (!impact) return { ok: false, message: "Subcategory not found." };

  await prisma.$transaction(async (tx) => {
    await tx.subcategory.update({
      where: { id: input.subcategoryId },
      data: {
        executionType: input.executionType,
        series: input.executionType === ExecutionType.INTERNAL_PRINT ? series : null,
      },
    });
    await writeAdminAuditLog(
      {
        actorId: user.id,
        action: AdminAuditAction.TAXONOMY_OVERRIDE_EXECUTION,
        targetType: "subcategory",
        targetId: input.subcategoryId,
        reason: input.reason,
        metadata: {
          fromExecutionType: subcategory.executionType,
          toExecutionType: input.executionType,
          fromSeries: subcategory.series,
          toSeries: input.executionType === ExecutionType.INTERNAL_PRINT ? series : null,
          purchaseRequestLineCount: impact.purchaseRequestLines,
          serialReservationCount: impact.serialReservations,
        },
      },
      tx,
    );
  });

  revalidateTaxonomyPaths();
  return { ok: true };
}

export async function adminMergeSubcategories(input: {
  sourceSubcategoryId: string;
  targetSubcategoryId: string;
  reason: string;
  deactivateSource?: boolean;
}): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(input.reason);
  if (reasonError) return { ok: false, message: reasonError };

  if (input.sourceSubcategoryId === input.targetSubcategoryId) {
    return { ok: false, message: "Source and target must differ." };
  }

  const [source, target] = await Promise.all([
    prisma.subcategory.findUnique({
      where: { id: input.sourceSubcategoryId },
      include: { category: { select: { billingGranularity: true } } },
    }),
    prisma.subcategory.findUnique({
      where: { id: input.targetSubcategoryId },
      include: { category: { select: { billingGranularity: true } } },
    }),
  ]);

  if (!source) return { ok: false, message: "Source subcategory not found." };
  if (!target) return { ok: false, message: "Target subcategory not found." };
  if (source.categoryId !== target.categoryId) {
    return {
      ok: false,
      message: "Both subcategories must belong to the same category. Reassign first if needed.",
    };
  }
  if (source.executionType !== target.executionType) {
    return { ok: false, message: "Execution types must match to merge subcategories." };
  }

  const sourceImpact = await getSubcategoryImpact(input.sourceSubcategoryId);
  if (sourceImpact && sourceImpact.openPurchaseRequests > 0) {
    return {
      ok: false,
      message: "Source subcategory has open purchase requests. Resolve or force-deactivate first.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const moved = await tx.catalogItem.updateMany({
      where: { subcategoryId: input.sourceSubcategoryId },
      data: { subcategoryId: input.targetSubcategoryId },
    });
    if (input.deactivateSource !== false) {
      await tx.subcategory.update({
        where: { id: input.sourceSubcategoryId },
        data: { status: TaxonomyStatus.INACTIVE },
      });
    }
    await writeAdminAuditLog(
      {
        actorId: user.id,
        action: AdminAuditAction.TAXONOMY_MERGE_SUBCATEGORIES,
        targetType: "subcategory",
        targetId: input.sourceSubcategoryId,
        reason: input.reason,
        metadata: {
          targetSubcategoryId: input.targetSubcategoryId,
          movedCatalogItems: moved.count,
          deactivatedSource: input.deactivateSource !== false,
        },
      },
      tx,
    );
  });

  revalidateTaxonomyPaths();
  return { ok: true };
}

export async function adminHardDeleteTaxonomyNode(input: {
  nodeType: "category" | "subcategory" | "catalogItem";
  nodeId: string;
  reason: string;
}): Promise<MutationResult> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(input.reason);
  if (reasonError) return { ok: false, message: reasonError };

  if (input.nodeType === "category") {
    const category = await prisma.category.findUnique({
      where: { id: input.nodeId },
      include: { _count: { select: { subcategories: true, purchaseRequestLines: true } } },
    });
    if (!category) return { ok: false, message: "Category not found." };
    if (category._count.subcategories > 0) {
      return { ok: false, message: "Remove all subcategories before hard delete." };
    }
    if (category._count.purchaseRequestLines > 0) {
      return { ok: false, message: "Category has purchase history. Cannot hard delete." };
    }
    await prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id: input.nodeId } });
      await writeAdminAuditLog(
        {
          actorId: user.id,
          action: AdminAuditAction.TAXONOMY_HARD_DELETE,
          targetType: "category",
          targetId: input.nodeId,
          reason: input.reason,
        },
        tx,
      );
    });
  } else if (input.nodeType === "subcategory") {
    const impact = await getSubcategoryImpact(input.nodeId);
    if (!impact) return { ok: false, message: "Subcategory not found." };
    if (
      impact.catalogItems.active +
        impact.catalogItems.pending +
        impact.catalogItems.inactive +
        impact.catalogItems.rejected >
      0
    ) {
      return { ok: false, message: "Remove or merge catalog items before hard delete." };
    }
    if (impact.purchaseRequestLines > 0 || impact.serialReservations > 0) {
      return { ok: false, message: "Subcategory has procurement history. Cannot hard delete." };
    }
    await prisma.$transaction(async (tx) => {
      await tx.subcategory.delete({ where: { id: input.nodeId } });
      await writeAdminAuditLog(
        {
          actorId: user.id,
          action: AdminAuditAction.TAXONOMY_HARD_DELETE,
          targetType: "subcategory",
          targetId: input.nodeId,
          reason: input.reason,
        },
        tx,
      );
    });
  } else {
    const impact = await getCatalogItemImpact(input.nodeId);
    if (!impact) return { ok: false, message: "Catalog item not found." };
    if (impact.purchaseRequestLines > 0) {
      return { ok: false, message: "Catalog item has purchase history. Cannot hard delete." };
    }
    await prisma.$transaction(async (tx) => {
      await tx.catalogItem.delete({ where: { id: input.nodeId } });
      await writeAdminAuditLog(
        {
          actorId: user.id,
          action: AdminAuditAction.TAXONOMY_HARD_DELETE,
          targetType: "catalogItem",
          targetId: input.nodeId,
          reason: input.reason,
        },
        tx,
      );
    });
  }

  revalidateTaxonomyPaths();
  return { ok: true };
}

export async function adminApproveAllPendingInSubcategory(
  subcategoryId: string,
  reason: string,
): Promise<MutationResult & { approvedCount?: number }> {
  const user = await guardAdminOnly();
  const reasonError = requireReason(reason);
  if (reasonError) return { ok: false, message: reasonError };

  const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!subcategory) return { ok: false, message: "Subcategory not found." };

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.catalogItem.updateMany({
      where: {
        subcategoryId,
        status: CatalogItemStatus.PENDING_APPROVAL,
      },
      data: {
        status: CatalogItemStatus.ACTIVE,
        approvedById: user.id,
        approvedAt: now,
        rejectedReason: null,
      },
    });
    await writeAdminAuditLog(
      {
        actorId: user.id,
        action: AdminAuditAction.TAXONOMY_BULK_APPROVE_CATALOG,
        targetType: "subcategory",
        targetId: subcategoryId,
        reason,
        metadata: { approvedCount: updated.count },
      },
      tx,
    );
    return updated.count;
  });

  revalidateTaxonomyPaths();
  return { ok: true, approvedCount: result };
}
