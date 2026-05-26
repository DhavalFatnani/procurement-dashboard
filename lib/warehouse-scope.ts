import { Role } from "@prisma/client";

import type { SessionUser } from "@/lib/session";

export type WarehouseIdFilter = string | { in: string[] };

/** Parse `app_metadata.warehouseIds` from Supabase JWT claims. */
export function warehouseIdsFromMetadata(
  appMetadata: Record<string, unknown>,
): string[] {
  const raw = appMetadata.warehouseIds;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * Warehouse IDs that scope list/inbox queries for the signed-in user.
 *
 * - SM: single assigned warehouse (from JWT `warehouseId`)
 * - Ops Head / Finance: all assigned warehouses (from JWT `warehouseIds`)
 * - Empty array means no warehouse restriction (legacy / unassigned)
 */
export function assignedWarehouseIds(user: SessionUser): string[] {
  if (user.role === Role.SM) {
    return user.warehouseId ? [user.warehouseId] : [];
  }
  if (user.role === Role.OPS_HEAD || user.role === Role.FINANCE) {
    return user.warehouseIds;
  }
  return [];
}

/** Prisma filter on `PurchaseRequest.warehouseId` (or nested `purchaseRequest.warehouseId`). */
export function warehouseScopeForUser(
  user: SessionUser,
): { warehouseId?: WarehouseIdFilter } {
  const ids = assignedWarehouseIds(user);
  if (ids.length === 0) {
    return {};
  }
  if (ids.length === 1) {
    return { warehouseId: ids[0]! };
  }
  return { warehouseId: { in: ids } };
}

export function nestedPurchaseRequestWarehouseScope(
  user: SessionUser,
): { purchaseRequest?: { warehouseId?: WarehouseIdFilter } } {
  const scope = warehouseScopeForUser(user);
  if (!scope.warehouseId) {
    return {};
  }
  return { purchaseRequest: scope };
}

export function nestedPurchaseOrderWarehouseScope(
  user: SessionUser,
): { purchaseOrder?: { purchaseRequest?: { warehouseId?: WarehouseIdFilter } } } {
  const scope = warehouseScopeForUser(user);
  if (!scope.warehouseId) {
    return {};
  }
  return { purchaseOrder: { purchaseRequest: scope } };
}

/** Whether Ops Head / Finance should pick warehouses in admin (multi-select). */
export function roleUsesMultiWarehouseAssignment(role: Role): boolean {
  return role === Role.OPS_HEAD || role === Role.FINANCE;
}

/** Whether the signed-in user may reserve serials for the given warehouse. */
export function userCanActForWarehouse(user: SessionUser, warehouseId: string): boolean {
  const ids = assignedWarehouseIds(user);
  if (ids.length === 0) {
    return true;
  }
  return ids.includes(warehouseId);
}
