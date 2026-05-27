import { describe, expect, it } from "vitest";

import {
  IT_HARDWARE_ASSETS_CATEGORY_NAME,
  LAST_MILE_CATEGORY_NAME,
  usesCatalogItemAtomicity,
  usesSubcategoryAtomicity,
} from "@/lib/catalog-atomicity";

describe("catalog-atomicity", () => {
  it("warehouse maintenance and IT hardware use catalog items", () => {
    expect(usesCatalogItemAtomicity("Warehouse Maintenance")).toBe(true);
    expect(usesCatalogItemAtomicity(IT_HARDWARE_ASSETS_CATEGORY_NAME)).toBe(true);
    expect(usesSubcategoryAtomicity("Warehouse Maintenance")).toBe(false);
    expect(usesSubcategoryAtomicity(IT_HARDWARE_ASSETS_CATEGORY_NAME)).toBe(false);
  });

  it("packaging, lock tags, and last mile use subcategory quantity", () => {
    expect(usesSubcategoryAtomicity("Packaging")).toBe(true);
    expect(usesSubcategoryAtomicity("Lock Tags")).toBe(true);
    expect(usesSubcategoryAtomicity(LAST_MILE_CATEGORY_NAME)).toBe(true);
    expect(usesCatalogItemAtomicity("Packaging")).toBe(false);
    expect(usesCatalogItemAtomicity("Lock Tags")).toBe(false);
    expect(usesCatalogItemAtomicity(LAST_MILE_CATEGORY_NAME)).toBe(false);
  });
});
