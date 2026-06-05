import { Role } from "@/lib/prisma-enums";

import type { SessionUser } from "@/lib/session";

/** Roles that may manage master data under /admin (users, warehouses, catalog). */
export const ADMIN_MASTER_DATA_ROLES = [Role.OPS_HEAD, Role.ADMIN] as const;

/** Ops workflows — Admin has global super-access alongside Ops Head. */
export const OPS_OR_ADMIN_ROLES = [Role.OPS_HEAD, Role.ADMIN] as const;

/** SM + Ops (+ Admin for global ops). */
export const SM_OPS_OR_ADMIN_ROLES = [Role.SM, Role.OPS_HEAD, Role.ADMIN] as const;

/** Finance workflows — Admin may settle payables globally. */
export const FINANCE_OR_ADMIN_ROLES = [Role.FINANCE, Role.ADMIN] as const;

/** Finance + Ops read paths that include Admin. */
export const OPS_FINANCE_OR_ADMIN_ROLES = [Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const;

/** All signed-in dashboard roles. */
export const ALL_DASHBOARD_ROLES = [Role.SM, Role.OPS_HEAD, Role.FINANCE, Role.ADMIN] as const;

/** Routes and mutations reserved for the Admin super-user role only. */
export const ADMIN_ONLY_ROLES = [Role.ADMIN] as const;

export function isAdminRole(role: Role): boolean {
  return role === Role.ADMIN;
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

/** Only Admin may permanently delete user accounts. */
export function canDeleteUser(actorRole: Role): boolean {
  return actorRole === Role.ADMIN;
}

/** Settle invoices, pay vendor advances, export finance registers. */
export function canManageFinance(role: Role): boolean {
  return role === Role.FINANCE || role === Role.ADMIN;
}
