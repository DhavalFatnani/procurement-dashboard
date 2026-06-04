import { CatalogItemKind, CatalogItemStatus } from "@/lib/prisma-enums";
import type { Prisma } from "@/lib/prisma-client";

const DISPUTED_NAME_SUFFIX = " — Disputed settlement";

export type DisputedCatalogTx = Pick<
  Prisma.TransactionClient,
  "catalogItem" | "purchaseOrder"
>;

/**
 * Idempotent: one ACTIVE disputed variant per base catalog item (same subcategory).
 */
export async function ensureDisputedCatalogVariant(
  tx: DisputedCatalogTx,
  baseCatalogItemId: string,
  createdById: string,
  auditNote?: string,
): Promise<string> {
  const base = await tx.catalogItem.findUnique({
    where: { id: baseCatalogItemId },
    select: {
      id: true,
      subcategoryId: true,
      name: true,
      sku: true,
      unit: true,
      status: true,
    },
  });
  if (!base) {
    throw new Error("Base catalog item not found.");
  }
  if (base.status !== CatalogItemStatus.ACTIVE) {
    throw new Error("Base catalog item must be active before creating a disputed variant.");
  }

  const existing = await tx.catalogItem.findFirst({
    where: {
      baseCatalogItemId: base.id,
      kind: CatalogItemKind.DISPUTED,
    },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const disputedName = `${base.name}${DISPUTED_NAME_SUFFIX}`;
  const created = await tx.catalogItem.create({
    data: {
      subcategoryId: base.subcategoryId,
      name: disputedName,
      sku: base.sku,
      unit: base.unit,
      kind: CatalogItemKind.DISPUTED,
      baseCatalogItemId: base.id,
      status: CatalogItemStatus.ACTIVE,
      createdById,
      approvedById: createdById,
      approvedAt: new Date(),
    },
    select: { id: true },
  });

  void auditNote;
  return created.id;
}

export function isDisputedCatalogName(name: string): boolean {
  return name.endsWith(DISPUTED_NAME_SUFFIX);
}
