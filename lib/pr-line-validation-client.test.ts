import { describe, expect, it } from "vitest";

import {
  prLineFieldId,
  validateVendorLineDrafts,
  type PRLineDraftForValidation,
} from "@/lib/pr-line-validation-client";
import { CategoryBillingGranularity } from "@/lib/prisma-enums";

const categories = [
  { id: "cat-pack", billingGranularity: CategoryBillingGranularity.SUBCATEGORY },
  { id: "cat-wh", billingGranularity: CategoryBillingGranularity.CATALOG_ITEM },
];

function subcategoryLine(overrides: Partial<PRLineDraftForValidation> = {}): PRLineDraftForValidation {
  return {
    key: "line-1",
    categoryId: "cat-pack",
    subcategoryId: "sub-1",
    quantity: 2,
    items: [],
    ...overrides,
  };
}

function catalogLine(overrides: Partial<PRLineDraftForValidation> = {}): PRLineDraftForValidation {
  return {
    key: "line-2",
    categoryId: "cat-wh",
    subcategoryId: "sub-wh",
    quantity: 1,
    items: [{ key: "item-1", quantity: 3, catalogItemId: "catalog-1" }],
    ...overrides,
  };
}

describe("validateVendorLineDrafts", () => {
  it("passes valid subcategory and catalog lines", () => {
    const result = validateVendorLineDrafts(
      [subcategoryLine(), catalogLine()],
      categories,
    );
    expect(result.ok).toBe(true);
  });

  it("flags missing category", () => {
    const result = validateVendorLineDrafts(
      [subcategoryLine({ categoryId: "" })],
      categories,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.field).toBe("category");
      expect(result.firstFieldId).toBe(prLineFieldId("line-1", "category"));
    }
  });

  it("flags missing subcategory", () => {
    const result = validateVendorLineDrafts(
      [subcategoryLine({ subcategoryId: "" })],
      categories,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "subcategory")).toBe(true);
    }
  });

  it("flags catalog line with qty but no item selected", () => {
    const result = validateVendorLineDrafts(
      [
        catalogLine({
          items: [{ key: "item-1", quantity: 5 }],
        }),
      ],
      categories,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.field).toBe("item");
      expect(result.firstFieldId).toBe(prLineFieldId("line-2", "item", "item-1"));
    }
  });

  it("flags subcategory line with quantity below 1", () => {
    const result = validateVendorLineDrafts(
      [subcategoryLine({ quantity: 0 })],
      categories,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "quantity")).toBe(true);
    }
  });
});
