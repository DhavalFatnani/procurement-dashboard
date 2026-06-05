import { Role } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import type { SessionUser } from "@/lib/session";
import {
  assignedWarehouseIds,
  scopeWarehouseIdsForUser,
  goodsReceiptViaPoWarehouseWhere,
  invoiceViaPoWarehouseWhere,
  purchaseOrderViaPrWarehouseWhere,
  purchaseRequestWarehouseWhere,
  roleUsesMultiWarehouseAssignment,
  UNASSIGNED_WAREHOUSE_SCOPE_ID,
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

  it("returns empty assigned list but global scope for Admin", () => {
    const user = session({
      role: Role.ADMIN,
      warehouseIds: ["w1", "w2", "w3"],
    });
    expect(assignedWarehouseIds(user)).toEqual([]);
    expect(scopeWarehouseIdsForUser(user)).toBeUndefined();
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

  it("fail-closed when unassigned", () => {
    expect(
      warehouseScopeForUser(session({ role: Role.OPS_HEAD, warehouseIds: [] })),
    ).toEqual({ warehouseId: UNASSIGNED_WAREHOUSE_SCOPE_ID });
  });
});

describe("purchaseOrderViaPrWarehouseWhere", () => {
  it("scopes PO queries via PR warehouse for multiple assignments", () => {
    expect(
      purchaseOrderViaPrWarehouseWhere(
        session({ role: Role.OPS_HEAD, warehouseIds: ["w1", "w2", "w3"] }),
      ),
    ).toEqual({
      purchaseRequest: { warehouseId: { in: ["w1", "w2", "w3"] } },
    });
  });

  it("fail-closed nested scope when unassigned", () => {
    expect(
      purchaseRequestWarehouseWhere(
        session({ role: Role.FINANCE, warehouseIds: [] }),
      ),
    ).toEqual({ warehouseId: UNASSIGNED_WAREHOUSE_SCOPE_ID });
    expect(
      goodsReceiptViaPoWarehouseWhere(
        session({ role: Role.FINANCE, warehouseIds: [] }),
      ),
    ).toEqual({
      purchaseOrder: { purchaseRequest: { warehouseId: UNASSIGNED_WAREHOUSE_SCOPE_ID } },
    });
    expect(
      invoiceViaPoWarehouseWhere(
        session({ role: Role.FINANCE, warehouseIds: [] }),
      ),
    ).toEqual({
      purchaseOrder: { purchaseRequest: { warehouseId: UNASSIGNED_WAREHOUSE_SCOPE_ID } },
    });
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

  it("denies all warehouses when user has no assignment scope", () => {
    const user = session({ role: Role.OPS_HEAD, warehouseIds: [] });
    expect(userCanActForWarehouse(user, "any-wh")).toBe(false);
  });
});
