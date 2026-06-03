import { Role } from "@/lib/prisma-enums";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SessionUser } from "@/lib/session";

const prismaMock = vi.hoisted(() => ({
  purchaseRequest: { findUnique: vi.fn() },
  purchaseOrder: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/queries/warehouses", () => ({
  getWarehousesAssignedToUser: vi.fn(async () => [{ id: "w1", name: "WH1", location: "A" }]),
}));

import { assertPurchaseOrderAccess } from "@/lib/warehouse-access";

function session(partial: Partial<SessionUser> & Pick<SessionUser, "role">): SessionUser {
  return {
    id: "u1",
    email: "a@b.com",
    user_metadata: {},
    app_metadata: {},
    warehouseId: null,
    warehouseIds: [],
    ...partial,
  };
}

describe("assertPurchaseOrderAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when PO warehouse is not assigned to user", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      purchaseRequest: { warehouseId: "w2" },
    });

    const result = await assertPurchaseOrderAccess("u1", "PO-001");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/not assigned/i);
    }
  });

  it("allows when PO warehouse matches user assignment", async () => {
    prismaMock.purchaseOrder.findUnique.mockResolvedValue({
      purchaseRequest: { warehouseId: "w1" },
    });

    const result = await assertPurchaseOrderAccess("u1", "PO-001");
    expect(result).toEqual({ ok: true });
  });
});

describe("session warehouse scope integration", () => {
  it("ops head with three warehouses uses IN filter shape", async () => {
    const { warehouseScopeForUser } = await import("@/lib/warehouse-scope");
    expect(
      warehouseScopeForUser(
        session({ role: Role.OPS_HEAD, warehouseIds: ["w1", "w2", "w3"] }),
      ),
    ).toEqual({ warehouseId: { in: ["w1", "w2", "w3"] } });
  });
});
