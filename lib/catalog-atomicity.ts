import { CategoryBillingGranularity } from "@/lib/prisma-enums";

/** Category names from seed / admin catalog (must match DB). */
export const PACKAGING_CATEGORY_NAME = "Packaging";
export const LOCK_TAGS_CATEGORY_NAME = "Lock Tags";
export const WAREHOUSE_MAINTENANCE_CATEGORY_NAME = "Warehouse Maintenance";
export const LAST_MILE_CATEGORY_NAME = "Last Mile";
export const IT_HARDWARE_ASSETS_CATEGORY_NAME = "IT and Hardware Assets";

export type CategoryAtomicityInput = {
  billingGranularity: CategoryBillingGranularity;
};

/** PR/PO/GRN bill per catalog item under a subcategory bucket. */
export function usesCatalogItemAtomicity(
  category: CategoryAtomicityInput,
): boolean {
  return category.billingGranularity === CategoryBillingGranularity.CATALOG_ITEM;
}

/** One quantity per subcategory row (no SM catalog picker). */
export function usesSubcategoryAtomicity(
  category: CategoryAtomicityInput,
): boolean {
  return category.billingGranularity === CategoryBillingGranularity.SUBCATEGORY;
}

export function categoryNameById(
  categoryId: string,
  categories: { id: string; name: string }[],
): string {
  return categories.find((c) => c.id === categoryId)?.name ?? "";
}

export function categoryById<T extends { id: string }>(
  categoryId: string,
  categories: T[],
): T | undefined {
  return categories.find((c) => c.id === categoryId);
}

/** Resolve billing granularity for a category id from a loaded list. */
export function billingGranularityByCategoryId(
  categoryId: string,
  categories: { id: string; billingGranularity: CategoryBillingGranularity }[],
): CategoryBillingGranularity | undefined {
  return categories.find((c) => c.id === categoryId)?.billingGranularity;
}
