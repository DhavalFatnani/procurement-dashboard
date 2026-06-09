import { describe, expect, it } from "vitest";

import {
  usesCatalogItemAtomicity,
  usesSubcategoryAtomicity,
} from "@/lib/catalog-atomicity";
import { CategoryBillingGranularity } from "@/lib/prisma-enums";

describe("catalog-atomicity", () => {
  it("catalog-item granularity uses catalog items", () => {
    const category = { billingGranularity: CategoryBillingGranularity.CATALOG_ITEM };
    expect(usesCatalogItemAtomicity(category)).toBe(true);
    expect(usesSubcategoryAtomicity(category)).toBe(false);
  });

  it("subcategory granularity uses subcategory quantity", () => {
    const category = { billingGranularity: CategoryBillingGranularity.SUBCATEGORY };
    expect(usesSubcategoryAtomicity(category)).toBe(true);
    expect(usesCatalogItemAtomicity(category)).toBe(false);
  });
});
