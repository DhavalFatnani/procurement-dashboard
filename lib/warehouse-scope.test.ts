import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { SessionUser } from "@/lib/session";
import {
  assignedWarehouseIds,
  roleUsesMultiWarehouseAssignment,
  userCanActForWarehouse,
  warehouseIdsFromMetadata,
  warehouseScopeForUser,
} from "@/lib/warehouse-scope";

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

describe("warehouseIdsFromMetadata", () => {
  it("parses string array from app_metadata", () => {
    expect(
      warehouseIdsFromMetadata({ warehouseIds: ["w1", "w2", 3, ""] }),
    ).toEqual(["w1", "w2"]);
  });
});

describe("assignedWarehouseIds", () => {
  it("returns single warehouse for SM", () => {
    expect(
      assignedWarehouseIds(session({ role: Role.SM, warehouseId: "wh-1" })),
    ).toEqual(["wh-1"]);
  });

  it("returns multiple warehouses for Ops Head and Finance", () => {
    const user = session({
      role: Role.FINANCE,
      warehouseIds: ["w1", "w2"],
    });
    expect(assignedWarehouseIds(user)).toEqual(["w1", "w2"]);
  });
});

describe("warehouseScopeForUser", () => {
  it("uses equality for one warehouse", () => {
    expect(
      warehouseScopeForUser(
        session({ role: Role.SM, warehouseId: "wh-1" }),
      ),
    ).toEqual({ warehouseId: "wh-1" });
  });

  it("uses IN for multiple warehouses", () => {
    expect(
      warehouseScopeForUser(
        session({ role: Role.OPS_HEAD, warehouseIds: ["w1", "w2"] }),
      ),
    ).toEqual({ warehouseId: { in: ["w1", "w2"] } });
  });

  it("returns empty scope when unassigned", () => {
    expect(
      warehouseScopeForUser(session({ role: Role.OPS_HEAD, warehouseIds: [] })),
    ).toEqual({});
  });
});

describe("roleUsesMultiWarehouseAssignment", () => {
  it("is true for Ops Head and Finance only", () => {
    expect(roleUsesMultiWarehouseAssignment(Role.OPS_HEAD)).toBe(true);
    expect(roleUsesMultiWarehouseAssignment(Role.FINANCE)).toBe(true);
    expect(roleUsesMultiWarehouseAssignment(Role.SM)).toBe(false);
  });
});

describe("userCanActForWarehouse", () => {
  it("allows SM to act only for assigned warehouse", () => {
    const user = session({ role: Role.SM, warehouseId: "wh-1" });
    expect(userCanActForWarehouse(user, "wh-1")).toBe(true);
    expect(userCanActForWarehouse(user, "wh-2")).toBe(false);
  });

  it("allows Ops Head to act for any assigned warehouse", () => {
    const user = session({ role: Role.OPS_HEAD, warehouseIds: ["w1", "w2"] });
    expect(userCanActForWarehouse(user, "w1")).toBe(true);
    expect(userCanActForWarehouse(user, "w3")).toBe(false);
  });

  it("allows any warehouse when user has no assignment scope", () => {
    const user = session({ role: Role.OPS_HEAD, warehouseIds: [] });
    expect(userCanActForWarehouse(user, "any-wh")).toBe(true);
  });
});
