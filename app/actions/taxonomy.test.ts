import { CategoryBillingGranularity, ExecutionType } from "@/lib/prisma-enums";
import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  category: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  subcategory: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  seriesConfig: {
    findFirst: vi.fn(),
  },
  purchaseRequestLine: {
    count: vi.fn(),
  },
  purchaseRequest: {
    count: vi.fn(),
  },
  catalogItem: {
    count: vi.fn(),
  },
  serialReservation: {
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("@/lib/server-action-guard", () => ({
  requireRoles: vi.fn().mockResolvedValue({ id: "user-1", role: "OPS_HEAD" }),
}));

vi.mock("@/lib/revalidate-tags", () => ({
  revalidateTaxonomyCache: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { createCategory, createSubcategory } from "@/app/actions/taxonomy";

describe("createCategory", () => {
  it("rejects names shorter than 2 characters", async () => {
    const res = await createCategory({
      name: "A",
      billingGranularity: CategoryBillingGranularity.SUBCATEGORY,
    });
    expect(res.ok).toBe(false);
  });
});

describe("createSubcategory", () => {
  it("requires series for internal print", async () => {
    prismaMock.category.findUnique.mockResolvedValueOnce({
      id: "cat-1",
      status: "ACTIVE",
    });

    const res = await createSubcategory({
      categoryId: "cat-1",
      name: "Jewellery Barcodes",
      executionType: ExecutionType.INTERNAL_PRINT,
      series: null,
    });

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/serial series/i);
  });
});
