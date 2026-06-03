import { ExecutionType } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  findLockTagsCategory,
  internalPrintSubcategories,
  LOCK_TAGS_CATEGORY_NAME,
} from "@/lib/create-pr-selection";

const categories = [
  { id: "cat-pack", name: "Packaging" },
  { id: "cat-lock", name: LOCK_TAGS_CATEGORY_NAME },
];

const subcategories = [
  {
    id: "sub-bag",
    name: "Courier Bag",
    categoryId: "cat-pack",
    executionType: ExecutionType.VENDOR_PURCHASE,
  },
  {
    id: "sub-jewellery",
    name: "Jewellery Barcodes",
    categoryId: "cat-lock",
    executionType: ExecutionType.INTERNAL_PRINT,
  },
  {
    id: "sub-apparel-vendor",
    name: "Apparel Lock Tags",
    categoryId: "cat-lock",
    executionType: ExecutionType.VENDOR_PURCHASE,
  },
  {
    id: "sub-apparel-print",
    name: "Accessories & Apparel Barcodes",
    categoryId: "cat-lock",
    executionType: ExecutionType.INTERNAL_PRINT,
  },
];

describe("findLockTagsCategory", () => {
  it("returns the Lock Tags category by name", () => {
    expect(findLockTagsCategory(categories)?.id).toBe("cat-lock");
  });
});

describe("internalPrintSubcategories", () => {
  it("returns only INTERNAL_PRINT subs for the given category", () => {
    expect(internalPrintSubcategories(subcategories, "cat-lock").map((s) => s.id)).toEqual([
      "sub-jewellery",
      "sub-apparel-print",
    ]);
  });

  it("returns empty for categories with no internal print subs", () => {
    expect(internalPrintSubcategories(subcategories, "cat-pack")).toEqual([]);
  });
});
