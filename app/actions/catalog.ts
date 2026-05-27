"use server";

import { CatalogItemStatus, ExecutionType, PRStatus, Role } from "@prisma/client";

import type { MutationResult } from "@/lib/action-result";
import { usesCatalogItemAtomicity } from "@/lib/catalog-atomicity";
import { normalizeCatalogItemName } from "@/lib/catalog-items";
import { prisma } from "@/lib/prisma";
import {
  revalidateCatalogCache,
  revalidatePurchaseRequestsCache,
} from "@/lib/revalidate-tags";
import { requireRoles } from "@/lib/server-action-guard";

const EDITABLE_PR_STATUSES: PRStatus[] = [
  PRStatus.DRAFT,
  PRStatus.PENDING_APPROVAL,
  PRStatus.REVISION_REQUIRED,
];

export async function createCatalogItem(data: {
  subcategoryId: string;
  name: string;
  sku?: string | null;
  unit: string;
}): Promise<MutationResult & { id?: string }> {
  const user = await requireRoles([Role.OPS_HEAD]);

  const sub = await prisma.subcategory.findUnique({
    where: { id: data.subcategoryId },
    select: {
      id: true,
      executionType: true,
      category: { select: { name: true } },
    },
  });
  if (
    !sub ||
    sub.executionType !== ExecutionType.VENDOR_PURCHASE ||
    !usesCatalogItemAtomicity(sub.category.name)
  ) {
    return {
      ok: false,
      message:
        "Catalog items can only be added under Warehouse Maintenance or IT and Hardware Assets subcategories.",
    };
  }

  const name = normalizeCatalogItemName(data.name);
  if (name.length < 2) {
    return { ok: false, message: "Item name must be at least 2 characters." };
  }

  const unit = data.unit.trim() || "pcs";
  const sku = data.sku?.trim() || null;
  const now = new Date();

  try {
    const created = await prisma.catalogItem.create({
      data: {
        subcategoryId: sub.id,
        name,
        sku,
        unit,
        status: CatalogItemStatus.ACTIVE,
        createdById: user.id,
        approvedById: user.id,
        approvedAt: now,
      },
    });
    revalidateCatalogCache();
    return { ok: true, id: created.id };
  } catch {
    return {
      ok: false,
      message: "An item with this name already exists under that subcategory.",
    };
  }
}

export async function updatePendingCatalogItem(
  id: string,
  data: { name: string; sku?: string | null; unit: string },
): Promise<MutationResult> {
  await requireRoles([Role.OPS_HEAD]);

  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    return { ok: false, message: "Catalog item not found." };
  }
  if (item.status !== CatalogItemStatus.PENDING_APPROVAL) {
    return {
      ok: false,
      message: "Only pending catalog items can be edited before approval.",
    };
  }

  const name = normalizeCatalogItemName(data.name);
  if (name.length < 2) {
    return { ok: false, message: "Item name must be at least 2 characters." };
  }

  const unit = data.unit.trim() || "pcs";
  const sku = data.sku?.trim() || null;

  try {
    await prisma.catalogItem.update({
      where: { id },
      data: { name, sku, unit },
    });
  } catch {
    return {
      ok: false,
      message: "An item with this name already exists under that subcategory.",
    };
  }

  revalidateCatalogCache();
  return { ok: true };
}

export async function updateCatalogItemDetails(
  id: string,
  data: { sku?: string | null; unit: string },
): Promise<MutationResult> {
  await requireRoles([Role.OPS_HEAD]);

  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    return { ok: false, message: "Catalog item not found." };
  }
  if (
    item.status !== CatalogItemStatus.ACTIVE &&
    item.status !== CatalogItemStatus.INACTIVE
  ) {
    return {
      ok: false,
      message: "Only active or inactive items can be edited.",
    };
  }

  const unit = data.unit.trim() || "pcs";
  const sku = data.sku?.trim() || null;

  await prisma.catalogItem.update({
    where: { id },
    data: { sku, unit },
  });

  revalidateCatalogCache();
  return { ok: true };
}

export async function approveCatalogItem(id: string): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);

  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    return { ok: false, message: "Catalog item not found." };
  }
  if (item.status !== CatalogItemStatus.PENDING_APPROVAL) {
    return { ok: false, message: "Only pending items can be approved." };
  }

  const now = new Date();
  await prisma.catalogItem.update({
    where: { id },
    data: {
      status: CatalogItemStatus.ACTIVE,
      approvedById: user.id,
      approvedAt: now,
      rejectedReason: null,
    },
  });

  revalidateCatalogCache();
  return { ok: true };
}

export async function rejectCatalogItem(
  id: string,
  reason: string,
): Promise<MutationResult> {
  const user = await requireRoles([Role.OPS_HEAD]);
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, message: "Rejection reason is required." };
  }

  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    return { ok: false, message: "Catalog item not found." };
  }
  if (item.status !== CatalogItemStatus.PENDING_APPROVAL) {
    return { ok: false, message: "Only pending items can be rejected." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.catalogItem.update({
      where: { id },
      data: {
        status: CatalogItemStatus.REJECTED,
        rejectedReason: trimmed,
        approvedById: null,
        approvedAt: null,
      },
    });
    await tx.purchaseRequestLineItem.deleteMany({
      where: {
        catalogItemId: id,
        prLine: {
          purchaseRequest: { status: { in: EDITABLE_PR_STATUSES } },
        },
      },
    });
  });

  revalidateCatalogCache();
  revalidatePurchaseRequestsCache();
  return { ok: true };
}

export async function deactivateCatalogItem(id: string): Promise<MutationResult> {
  await requireRoles([Role.OPS_HEAD]);

  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    return { ok: false, message: "Catalog item not found." };
  }
  if (item.status !== CatalogItemStatus.ACTIVE) {
    return { ok: false, message: "Only active items can be deactivated." };
  }

  await prisma.catalogItem.update({
    where: { id },
    data: { status: CatalogItemStatus.INACTIVE },
  });

  revalidateCatalogCache();
  return { ok: true };
}

export async function reactivateCatalogItem(id: string): Promise<MutationResult> {
  await requireRoles([Role.OPS_HEAD]);

  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) {
    return { ok: false, message: "Catalog item not found." };
  }
  if (item.status !== CatalogItemStatus.INACTIVE) {
    return { ok: false, message: "Only inactive items can be reactivated." };
  }

  await prisma.catalogItem.update({
    where: { id },
    data: { status: CatalogItemStatus.ACTIVE },
  });

  revalidateCatalogCache();
  return { ok: true };
}
