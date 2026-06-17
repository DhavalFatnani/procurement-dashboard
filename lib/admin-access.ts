import { Role } from "@/lib/prisma-enums";

import type { SessionUser } from "@/lib/session";

/** Roles that may open master-data admin routes (warehouses, taxonomy). */
export const ADMIN_MASTER_DATA_ROLES = [
  Role.CENTRAL_TEAM,
  Role.OPS_HEAD,
  Role.ADMIN,
] as const;

/** User provisioning under /admin/users — Central Team excluded. */
export const USER_ADMIN_ROLES = [Role.OPS_HEAD, Role.ADMIN] as const;

/** Broad ops workflows — Central Team included; Admin has global super-access. */
export const CENTRAL_OPS_OR_ADMIN_ROLES = [
  Role.CENTRAL_TEAM,
  Role.OPS_HEAD,
  Role.ADMIN,
] as const;

/** @deprecated Use CENTRAL_OPS_OR_ADMIN_ROLES or PR_APPROVAL_ROLES as appropriate. */
export const OPS_OR_ADMIN_ROLES = CENTRAL_OPS_OR_ADMIN_ROLES;

/** PR sign-off and consequential judgment calls — Ops Head + Admin only. */
export const PR_APPROVAL_ROLES = [Role.OPS_HEAD, Role.ADMIN] as const;

/** SM + Central Team + Ops Head + Admin (operational workflows). */
export const SM_OPS_OR_ADMIN_ROLES = [
  Role.SM,
  Role.CENTRAL_TEAM,
  Role.OPS_HEAD,
  Role.ADMIN,
] as const;

/** Finance workflows — Admin may settle payables globally. */
export const FINANCE_OR_ADMIN_ROLES = [Role.FINANCE, Role.ADMIN] as const;

/** Finance + Ops read paths that include Central Team and Admin. */
export const OPS_FINANCE_OR_ADMIN_ROLES = [
  Role.CENTRAL_TEAM,
  Role.OPS_HEAD,
  Role.FINANCE,
  Role.ADMIN,
] as const;

/** All signed-in dashboard roles. */
export const ALL_DASHBOARD_ROLES = [
  Role.SM,
  Role.CENTRAL_TEAM,
  Role.OPS_HEAD,
  Role.FINANCE,
  Role.ADMIN,
] as const;

/** Routes and mutations reserved for the Admin super-user role only. */
export const ADMIN_ONLY_ROLES = [Role.ADMIN] as const;

export function isAdminRole(role: Role): boolean {
  return role === Role.ADMIN;
}

/** Ops Head workflows — Admin has the same operational capabilities globally. */
export function isOpsHeadOrAdmin(role: Role): boolean {
  return role === Role.OPS_HEAD || role === Role.ADMIN;
}

/** Central Team + Ops Head + Admin operational workflows (excludes PR approval). */
export function isCentralOpsOrAbove(role: Role): boolean {
  return (
    role === Role.CENTRAL_TEAM ||
    role === Role.OPS_HEAD ||
    role === Role.ADMIN
  );
}

/** Central Team, Ops Head, and Admin may configure purchase orders from approved PRs. */
export function canAccessConfigurePO(role: Role): boolean {
  return isCentralOpsOrAbove(role);
}

/** Whether the role may approve, reject, or revert purchase requests. */
export function canApprovePurchaseRequest(role: Role): boolean {
  return role === Role.OPS_HEAD || role === Role.ADMIN;
}

/** Admin bypasses warehouse assignment checks and list scoping. */
export function hasGlobalWarehouseScope(role: Role): boolean {
  return role === Role.ADMIN;
}

export function sessionHasGlobalWarehouseScope(user: SessionUser): boolean {
  return hasGlobalWarehouseScope(user.role);
}

/** Only Admin may create or promote users to the Admin role. */
export function canAssignAdminRole(actorRole: Role): boolean {
  return actorRole === Role.ADMIN;
}

/** Only Admin may create or promote users to Ops Head. */
export function canAssignOpsHeadRole(actorRole: Role): boolean {
  return actorRole === Role.ADMIN;
}

/** Whether actor may assign targetRole when creating or updating a user. */
export function canAssignRole(actorRole: Role, targetRole: Role): boolean {
  if (targetRole === Role.ADMIN) {
    return canAssignAdminRole(actorRole);
  }
  if (targetRole === Role.OPS_HEAD) {
    return canAssignOpsHeadRole(actorRole);
  }
  if (actorRole === Role.ADMIN || actorRole === Role.OPS_HEAD) {
    return true;
  }
  return false;
}

/** Roles the actor may pick in the user admin UI. */
export function assignableRolesFor(actorRole: Role): Role[] {
  return ALL_DASHBOARD_ROLES.filter((r) => canAssignRole(actorRole, r));
}

/** Only Admin may permanently delete user accounts. */
export function canDeleteUser(actorRole: Role): boolean {
  return actorRole === Role.ADMIN;
}

/** Settle invoices, pay vendor advances, export finance registers. */
export function canManageFinance(role: Role): boolean {
  return role === Role.FINANCE || role === Role.ADMIN;
}
