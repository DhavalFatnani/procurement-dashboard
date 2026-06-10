import {
  CategoryBillingGranularity,
  TaxonomyStatus,
} from "@/lib/prisma-enums";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const prismaMock = vi.hoisted(() => ({
  category: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  subcategory: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  catalogItem: {
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  seriesConfig: {
    findFirst: vi.fn(),
  },
  purchaseRequest: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  purchaseRequestLine: {
    count: vi.fn().mockResolvedValue(0),
  },
  serialReservation: {
    count: vi.fn().mockResolvedValue(0),
  },
  adminAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
}));

vi.mock("@/lib/server-action-guard", () => ({
  requireRoles: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }),
}));

vi.mock("@/lib/revalidate-tags", () => ({
  revalidateTaxonomyCache: vi.fn(),
  revalidateCatalogCache: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const impactMock = vi.hoisted(() => ({
  getCategoryImpact: vi.fn(),
  getSubcategoryImpact: vi.fn(),
  getCatalogItemImpact: vi.fn(),
}));

vi.mock("@/lib/queries/taxonomy-impact", () => impactMock);

import {
  adminCascadeDeactivateCategory,
  adminForceDeactivateCategory,
  adminReassignSubcategory,
} from "@/app/actions/taxonomy-admin";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prismaMock),
  );
});

describe("adminCascadeDeactivateCategory", () => {
  it("requires a reason", async () => {
    const res = await adminCascadeDeactivateCategory("cat-1", "  ");
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/reason/i);
  });

  it("blocks when open purchase requests exist", async () => {
    prismaMock.category.findUnique.mockResolvedValueOnce({
      id: "cat-1",
      status: TaxonomyStatus.ACTIVE,
      subcategories: [{ id: "sub-1" }],
    });
    impactMock.getCategoryImpact.mockResolvedValueOnce({
      openPurchaseRequests: 1,
      openPurchaseRequestIds: ["pr-1"],
      purchaseRequestLines: 0,
      catalogItems: { active: 0, pending: 0, inactive: 0, rejected: 0 },
      serialReservations: 0,
      linkedSeries: null,
      blockers: [],
    });

    const res = await adminCascadeDeactivateCategory("cat-1", "Structural cleanup");
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/force deactivate/i);
  });
});

describe("adminForceDeactivateCategory", () => {
  it("cascades deactivation with audit", async () => {
    prismaMock.category.findUnique.mockResolvedValueOnce({
      id: "cat-1",
      status: TaxonomyStatus.ACTIVE,
      subcategories: [{ id: "sub-1" }],
    });
    impactMock.getCategoryImpact.mockResolvedValueOnce({
      openPurchaseRequests: 1,
      openPurchaseRequestIds: ["pr-1"],
      purchaseRequestLines: 0,
      catalogItems: { active: 0, pending: 0, inactive: 0, rejected: 0 },
      serialReservations: 0,
      linkedSeries: null,
      blockers: [],
    });
    prismaMock.catalogItem.updateMany.mockResolvedValueOnce({ count: 2 });
    prismaMock.subcategory.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.category.update.mockResolvedValueOnce({});
    prismaMock.adminAuditLog.create.mockResolvedValueOnce({});

    const res = await adminForceDeactivateCategory("cat-1", "Retire misconfigured branch");
    expect(res.ok).toBe(true);
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalled();
  });
});

describe("adminReassignSubcategory", () => {
  it("requires granularity resolution when parents differ", async () => {
    prismaMock.subcategory.findUnique.mockResolvedValueOnce({
      id: "sub-1",
      categoryId: "cat-a",
      category: {
        id: "cat-a",
        billingGranularity: CategoryBillingGranularity.CATALOG_ITEM,
        name: "Vendor items",
      },
    });
    prismaMock.category.findUnique.mockResolvedValueOnce({
      id: "cat-b",
      billingGranularity: CategoryBillingGranularity.SUBCATEGORY,
      name: "Qty billing",
      status: TaxonomyStatus.ACTIVE,
    });

    const res = await adminReassignSubcategory({
      subcategoryId: "sub-1",
      targetCategoryId: "cat-b",
      reason: "Move under qty billing parent",
    });

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/billing granularity/i);
  });

  it("moves subcategory after aligning target granularity", async () => {
    prismaMock.subcategory.findUnique.mockResolvedValueOnce({
      id: "sub-1",
      categoryId: "cat-a",
      category: {
        id: "cat-a",
        billingGranularity: CategoryBillingGranularity.CATALOG_ITEM,
        name: "Vendor items",
      },
    });
    prismaMock.category.findUnique.mockResolvedValueOnce({
      id: "cat-b",
      billingGranularity: CategoryBillingGranularity.SUBCATEGORY,
      name: "Qty billing",
      status: TaxonomyStatus.ACTIVE,
    });
    prismaMock.category.update.mockResolvedValue({});
    prismaMock.subcategory.update.mockResolvedValue({});
    prismaMock.adminAuditLog.create.mockResolvedValue({});

    const res = await adminReassignSubcategory({
      subcategoryId: "sub-1",
      targetCategoryId: "cat-b",
      reason: "Consolidate under qty billing",
      granularityResolution: "align-target-to-source",
    });

    expect(res.ok).toBe(true);
    expect(prismaMock.category.update).toHaveBeenCalled();
    expect(prismaMock.subcategory.update).toHaveBeenCalled();
    expect(prismaMock.adminAuditLog.create).toHaveBeenCalledTimes(2);
  });
});
