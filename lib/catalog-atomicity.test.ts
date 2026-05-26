import { describe, expect, it } from "vitest";

import {
  usesCatalogItemAtomicity,
  usesSubcategoryAtomicity,
} from "@/lib/catalog-atomicity";

describe("catalog-atomicity", () => {
  it("warehouse maintenance uses catalog items", () => {
    expect(usesCatalogItemAtomicity("Warehouse Maintenance")).toBe(true);
    expect(usesSubcategoryAtomicity("Warehouse Maintenance")).toBe(false);
  });

  it("packaging and lock tags use subcategory quantity", () => {
    expect(usesSubcategoryAtomicity("Packaging")).toBe(true);
    expect(usesSubcategoryAtomicity("Lock Tags")).toBe(true);
    expect(usesCatalogItemAtomicity("Packaging")).toBe(false);
    expect(usesCatalogItemAtomicity("Lock Tags")).toBe(false);
  });
});
