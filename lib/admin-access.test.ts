import { Role } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  canAssignAdminRole,
  canDeleteUser,
  canManageFinance,
  hasGlobalWarehouseScope,
  isAdminRole,
} from "@/lib/admin-access";

describe("admin-access", () => {
  it("identifies Admin role", () => {
    expect(isAdminRole(Role.ADMIN)).toBe(true);
    expect(isAdminRole(Role.OPS_HEAD)).toBe(false);
  });

  it("grants global warehouse scope only to Admin", () => {
    expect(hasGlobalWarehouseScope(Role.ADMIN)).toBe(true);
    expect(hasGlobalWarehouseScope(Role.OPS_HEAD)).toBe(false);
  });

  it("restricts Admin role assignment to Admin actors", () => {
    expect(canAssignAdminRole(Role.ADMIN)).toBe(true);
    expect(canAssignAdminRole(Role.OPS_HEAD)).toBe(false);
  });

  it("restricts user deletion to Admin actors", () => {
    expect(canDeleteUser(Role.ADMIN)).toBe(true);
    expect(canDeleteUser(Role.OPS_HEAD)).toBe(false);
  });

  it("grants finance write access to Finance and Admin", () => {
    expect(canManageFinance(Role.FINANCE)).toBe(true);
    expect(canManageFinance(Role.ADMIN)).toBe(true);
    expect(canManageFinance(Role.OPS_HEAD)).toBe(false);
    expect(canManageFinance(Role.SM)).toBe(false);
  });
});
