import { CatalogItemStatus, TaxonomyStatus } from "@/lib/prisma-enums";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const prismaMock = vi.hoisted(() => ({
  category: { findUnique: vi.fn() },
  subcategory: { findUnique: vi.fn() },
  catalogItem: { findMany: vi.fn() },
  purchaseRequest: { findMany: vi.fn().mockResolvedValue([]) },
  serialReservation: { count: vi.fn().mockResolvedValue(0) },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { getCategoryImpact, getSubcategoryImpact } from "@/lib/queries/taxonomy-impact";

describe("getCategoryImpact", () => {
  it("reports active subcategory blockers", async () => {
    prismaMock.category.findUnique.mockResolvedValueOnce({
      id: "cat-1",
      status: TaxonomyStatus.ACTIVE,
      _count: { purchaseRequestLines: 0 },
      subcategories: [
        {
          id: "sub-1",
          status: TaxonomyStatus.ACTIVE,
          catalogItems: [],
        },
      ],
    });

    const impact = await getCategoryImpact("cat-1");
    expect(impact?.blockers.some((b) => b.code === "ACTIVE_SUBCATEGORIES")).toBe(true);
  });
});

describe("getSubcategoryImpact", () => {
  it("reports active catalog item blockers", async () => {
    prismaMock.subcategory.findUnique.mockResolvedValueOnce({
      id: "sub-1",
      status: TaxonomyStatus.ACTIVE,
      series: null,
      executionType: "VENDOR_PURCHASE",
      category: { status: TaxonomyStatus.ACTIVE },
      catalogItems: [{ status: CatalogItemStatus.ACTIVE }],
      _count: { purchaseRequestLines: 0 },
    });
    prismaMock.catalogItem.findMany.mockResolvedValueOnce([{ id: "item-1" }]);

    const impact = await getSubcategoryImpact("sub-1");
    expect(impact?.blockers.some((b) => b.code === "ACTIVE_CATALOG_ITEMS")).toBe(true);
  });
});
