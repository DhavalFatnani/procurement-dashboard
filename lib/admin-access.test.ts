import { Role } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  assignableRolesFor,
  canApprovePurchaseRequest,
  canAssignAdminRole,
  canAssignOpsHeadRole,
  canAssignRole,
  canDeleteUser,
  canManageFinance,
  hasGlobalWarehouseScope,
  isAdminRole,
  isCentralOpsOrAbove,
  isOpsHeadOrAdmin,
} from "@/lib/admin-access";

describe("admin-access", () => {
  it("identifies Admin role", () => {
    expect(isAdminRole(Role.ADMIN)).toBe(true);
    expect(isAdminRole(Role.OPS_HEAD)).toBe(false);
  });

  it("grants global warehouse scope only to Admin", () => {
    expect(hasGlobalWarehouseScope(Role.ADMIN)).toBe(true);
    expect(hasGlobalWarehouseScope(Role.OPS_HEAD)).toBe(false);
    expect(hasGlobalWarehouseScope(Role.CENTRAL_TEAM)).toBe(false);
  });

  it("restricts Admin role assignment to Admin actors", () => {
    expect(canAssignAdminRole(Role.ADMIN)).toBe(true);
    expect(canAssignAdminRole(Role.OPS_HEAD)).toBe(false);
  });

  it("restricts Ops Head role assignment to Admin actors", () => {
    expect(canAssignOpsHeadRole(Role.ADMIN)).toBe(true);
    expect(canAssignOpsHeadRole(Role.OPS_HEAD)).toBe(false);
  });

  it("restricts user deletion to Admin actors", () => {
    expect(canDeleteUser(Role.ADMIN)).toBe(true);
    expect(canDeleteUser(Role.OPS_HEAD)).toBe(false);
  });

  it("treats Admin as Ops Head for operational workflows", () => {
    expect(isOpsHeadOrAdmin(Role.OPS_HEAD)).toBe(true);
    expect(isOpsHeadOrAdmin(Role.ADMIN)).toBe(true);
    expect(isOpsHeadOrAdmin(Role.CENTRAL_TEAM)).toBe(false);
    expect(isOpsHeadOrAdmin(Role.SM)).toBe(false);
    expect(isOpsHeadOrAdmin(Role.FINANCE)).toBe(false);
  });

  it("includes Central Team in central ops workflows", () => {
    expect(isCentralOpsOrAbove(Role.CENTRAL_TEAM)).toBe(true);
    expect(isCentralOpsOrAbove(Role.OPS_HEAD)).toBe(true);
    expect(isCentralOpsOrAbove(Role.ADMIN)).toBe(true);
    expect(isCentralOpsOrAbove(Role.SM)).toBe(false);
  });

  it("limits PR approval to Ops Head and Admin", () => {
    expect(canApprovePurchaseRequest(Role.OPS_HEAD)).toBe(true);
    expect(canApprovePurchaseRequest(Role.ADMIN)).toBe(true);
    expect(canApprovePurchaseRequest(Role.CENTRAL_TEAM)).toBe(false);
    expect(canApprovePurchaseRequest(Role.SM)).toBe(false);
  });

  it("scopes assignable roles by actor hierarchy", () => {
    expect(assignableRolesFor(Role.ADMIN)).toEqual([
      Role.SM,
      Role.CENTRAL_TEAM,
      Role.OPS_HEAD,
      Role.FINANCE,
      Role.ADMIN,
    ]);
    expect(assignableRolesFor(Role.OPS_HEAD)).toEqual([
      Role.SM,
      Role.CENTRAL_TEAM,
      Role.FINANCE,
    ]);
    expect(canAssignRole(Role.OPS_HEAD, Role.CENTRAL_TEAM)).toBe(true);
    expect(canAssignRole(Role.OPS_HEAD, Role.ADMIN)).toBe(false);
    expect(canAssignRole(Role.OPS_HEAD, Role.OPS_HEAD)).toBe(false);
  });

  it("grants finance write access to Finance and Admin", () => {
    expect(canManageFinance(Role.FINANCE)).toBe(true);
    expect(canManageFinance(Role.ADMIN)).toBe(true);
    expect(canManageFinance(Role.OPS_HEAD)).toBe(false);
    expect(canManageFinance(Role.CENTRAL_TEAM)).toBe(false);
    expect(canManageFinance(Role.SM)).toBe(false);
  });
});
