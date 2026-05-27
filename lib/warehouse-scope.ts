import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";

import type { SessionUser } from "@/lib/session";

export type WarehouseIdFilter = string | { in: string[] };

/** Sentinel warehouse id used in fail-closed filters (never matches real rows). */
export const UNASSIGNED_WAREHOUSE_SCOPE_ID = "__unassigned__";

export const WAREHOUSE_ACCESS_DENIED_MESSAGE =
  "You are not assigned to that warehouse.";

export const NO_WAREHOUSE_ASSIGNED_MESSAGE =
  "Your profile has no warehouse assigned.";

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
 * - Empty array when unassigned (fail closed downstream)
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

/** Build a Prisma `warehouseId` filter; fail closed when no warehouses assigned. */
export function warehouseIdFilter(ids: string[]): WarehouseIdFilter {
  if (ids.length === 0) {
    return UNASSIGNED_WAREHOUSE_SCOPE_ID;
  }
  if (ids.length === 1) {
    return ids[0]!;
  }
  return { in: ids };
}

/** Prisma filter on `PurchaseRequest.warehouseId`. */
export function warehouseScopeForUser(
  user: SessionUser,
): { warehouseId: WarehouseIdFilter } {
  return { warehouseId: warehouseIdFilter(assignedWarehouseIds(user)) };
}

export function purchaseRequestWarehouseWhere(
  user: SessionUser,
): Prisma.PurchaseRequestWhereInput {
  return warehouseScopeForUser(user);
}

export function purchaseOrderViaPrWarehouseWhere(
  user: SessionUser,
): Prisma.PurchaseOrderWhereInput {
  return { purchaseRequest: warehouseScopeForUser(user) };
}

export function goodsReceiptViaPoWarehouseWhere(
  user: SessionUser,
): Prisma.GoodsReceiptWhereInput {
  return { purchaseOrder: purchaseOrderViaPrWarehouseWhere(user) };
}

export function invoiceViaPoWarehouseWhere(user: SessionUser): Prisma.InvoiceWhereInput {
  return { purchaseOrder: purchaseOrderViaPrWarehouseWhere(user) };
}

export function nestedPurchaseRequestWarehouseScope(
  user: SessionUser,
): { purchaseRequest: { warehouseId: WarehouseIdFilter } } {
  return { purchaseRequest: warehouseScopeForUser(user) };
}

export function nestedPurchaseOrderWarehouseScope(
  user: SessionUser,
): { purchaseOrder: { purchaseRequest: { warehouseId: WarehouseIdFilter } } } {
  return { purchaseOrder: { purchaseRequest: warehouseScopeForUser(user) } };
}

/** Scope warehouse IDs for raw SQL / optional filter params (always returns array). */
export function scopeWarehouseIdsForUser(user: SessionUser): string[] {
  return assignedWarehouseIds(user);
}

/** PO list/detail filter from explicit scope ids (page loaders pass assignedWarehouseIds). */
export function purchaseOrderWhereFromScopeIds(
  scopeWarehouseIds?: string[],
): Prisma.PurchaseOrderWhereInput {
  if (scopeWarehouseIds === undefined) {
    return {};
  }
  return {
    purchaseRequest: { warehouseId: warehouseIdFilter(scopeWarehouseIds) },
  };
}

/** GRN list filter from explicit scope ids. */
export function goodsReceiptWhereFromScopeIds(
  scopeWarehouseIds?: string[],
): Prisma.GoodsReceiptWhereInput {
  if (scopeWarehouseIds === undefined) {
    return {};
  }
  return {
    purchaseOrder: {
      purchaseRequest: { warehouseId: warehouseIdFilter(scopeWarehouseIds) },
    },
  };
}

/** Invoice list filter from explicit scope ids. */
export function invoiceWhereFromScopeIds(
  scopeWarehouseIds?: string[],
): Prisma.InvoiceWhereInput {
  if (scopeWarehouseIds === undefined) {
    return {};
  }
  return {
    purchaseOrder: {
      purchaseRequest: { warehouseId: warehouseIdFilter(scopeWarehouseIds) },
    },
  };
}

/** Whether Ops Head / Finance should pick warehouses in admin (multi-select). */
export function roleUsesMultiWarehouseAssignment(role: Role): boolean {
  return role === Role.OPS_HEAD || role === Role.FINANCE;
}

/** Whether the signed-in user may act on the given warehouse (fail closed when unassigned). */
export function userCanActForWarehouse(user: SessionUser, warehouseId: string): boolean {
  const ids = assignedWarehouseIds(user);
  if (ids.length === 0) {
    return false;
  }
  return ids.includes(warehouseId);
}

/** Sync session guard for warehouse-bound actions. */
export function assertSessionCanAccessWarehouse(
  user: SessionUser,
  warehouseId: string,
): { ok: true } | { ok: false; message: string } {
  const ids = assignedWarehouseIds(user);
  if (ids.length === 0) {
    return { ok: false, message: NO_WAREHOUSE_ASSIGNED_MESSAGE };
  }
  if (!ids.includes(warehouseId)) {
    return { ok: false, message: WAREHOUSE_ACCESS_DENIED_MESSAGE };
  }
  return { ok: true };
}
