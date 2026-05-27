/** Category names from seed / admin catalog (must match DB). */
export const PACKAGING_CATEGORY_NAME = "Packaging";
export const LOCK_TAGS_CATEGORY_NAME = "Lock Tags";
export const WAREHOUSE_MAINTENANCE_CATEGORY_NAME = "Warehouse Maintenance";
export const LAST_MILE_CATEGORY_NAME = "Last Mile";
export const IT_HARDWARE_ASSETS_CATEGORY_NAME = "IT and Hardware Assets";

const CATALOG_ITEM_ATOMICITY_CATEGORIES = [
  WAREHOUSE_MAINTENANCE_CATEGORY_NAME,
  IT_HARDWARE_ASSETS_CATEGORY_NAME,
] as const;

const SUBCATEGORY_ATOMICITY_CATEGORIES = [
  PACKAGING_CATEGORY_NAME,
  LOCK_TAGS_CATEGORY_NAME,
  LAST_MILE_CATEGORY_NAME,
] as const;

/** PR/PO/GRN bill per catalog item under a subcategory bucket. */
export function usesCatalogItemAtomicity(categoryName: string): boolean {
  return (CATALOG_ITEM_ATOMICITY_CATEGORIES as readonly string[]).includes(
    categoryName,
  );
}

/** One quantity per subcategory row (no SM catalog picker). */
export function usesSubcategoryAtomicity(categoryName: string): boolean {
  return (SUBCATEGORY_ATOMICITY_CATEGORIES as readonly string[]).includes(
    categoryName,
  );
}

export function catalogItemAtomicityCategoryNames(): readonly string[] {
  return CATALOG_ITEM_ATOMICITY_CATEGORIES;
}

export function categoryNameById(
  categoryId: string,
  categories: { id: string; name: string }[],
): string {
  return categories.find((c) => c.id === categoryId)?.name ?? "";
}
