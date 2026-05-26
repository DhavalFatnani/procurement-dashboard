import { ExecutionType } from "@prisma/client";

export type CategoryOption = { id: string; name: string };
export type SubcategoryOption = {
  id: string;
  name: string;
  categoryId: string;
  executionType: ExecutionType;
};

export const LOCK_TAGS_CATEGORY_NAME = "Lock Tags";

export function findLockTagsCategory(
  categories: CategoryOption[],
): CategoryOption | undefined {
  return categories.find((c) => c.name === LOCK_TAGS_CATEGORY_NAME);
}

/** Subcategories eligible for internal print under a category. */
export function internalPrintSubcategories(
  subcategories: SubcategoryOption[],
  categoryId: string,
): SubcategoryOption[] {
  return subcategories.filter(
    (s) => s.categoryId === categoryId && s.executionType === ExecutionType.INTERNAL_PRINT,
  );
}

/** Resolved selection — only set when subcategory belongs to the chosen category */
export type CreatePRSelection = {
  categoryId: string;
  subcategoryId: string;
  categoryName: string;
  subcategoryName: string;
  executionType: ExecutionType;
  isLockTags: boolean;
  flowKey: string;
};

export function resolveCreatePRSelection(
  categories: CategoryOption[],
  subcategories: SubcategoryOption[],
  categoryId: string,
  subcategoryId: string,
): CreatePRSelection | null {
  if (!categoryId || !subcategoryId) {
    return null;
  }

  const category = categories.find((c) => c.id === categoryId);
  const subcategory = subcategories.find(
    (s) => s.id === subcategoryId && s.categoryId === categoryId,
  );

  if (!category || !subcategory) {
    return null;
  }

  return {
    categoryId: category.id,
    subcategoryId: subcategory.id,
    categoryName: category.name,
    subcategoryName: subcategory.name,
    executionType: subcategory.executionType,
    isLockTags: category.name === "Lock Tags",
    flowKey: `${category.id}:${subcategory.id}:${subcategory.executionType}`,
  };
}

export type DownstreamFieldReset = {
  vendorId: string;
  vendorRequestId: string | null;
  pendingVendorLabel: string | null;
  serialHint: null;
  printOpen: false;
  vendorSheetOpen: false;
};

export const DOWNSTREAM_FIELD_RESET: DownstreamFieldReset = {
  vendorId: "",
  vendorRequestId: null,
  pendingVendorLabel: null,
  serialHint: null,
  printOpen: false,
  vendorSheetOpen: false,
};
