/** Category names from seed / admin catalog (must match DB). */
export const PACKAGING_CATEGORY_NAME = "Packaging";
export const LOCK_TAGS_CATEGORY_NAME = "Lock Tags";
export const WAREHOUSE_MAINTENANCE_CATEGORY_NAME = "Warehouse Maintenance";

/** Warehouse Maintenance: PR/PO/GRN bill per catalog item under a subcategory bucket. */
export function usesCatalogItemAtomicity(categoryName: string): boolean {
  return categoryName === WAREHOUSE_MAINTENANCE_CATEGORY_NAME;
}

/** Packaging and Lock Tags: one quantity per subcategory row (no SM catalog picker). */
export function usesSubcategoryAtomicity(categoryName: string): boolean {
  return (
    categoryName === PACKAGING_CATEGORY_NAME ||
    categoryName === LOCK_TAGS_CATEGORY_NAME
  );
}

export function categoryNameById(
  categoryId: string,
  categories: { id: string; name: string }[],
): string {
  return categories.find((c) => c.id === categoryId)?.name ?? "";
}
