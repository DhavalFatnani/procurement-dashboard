import type { Prisma } from "@/lib/prisma-client";
import { Role } from "@/lib/prisma-enums";

import { hasGlobalWarehouseScope } from "@/lib/admin-access";
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
  if (hasGlobalWarehouseScope(user.role)) {
    return [];
  }
  if (user.role === Role.SM) {
    return user.warehouseId ? [user.warehouseId] : [];
  }
  if (user.role === Role.OPS_HEAD || user.role === Role.FINANCE || user.role === Role.CENTRAL_TEAM) {
    return user.warehouseIds;
  }
  return [];
}

/**
 * Warehouse IDs for list/inbox query scoping.
 * Returns `undefined` for Admin (no warehouse filter — global scope).
 */
export function scopeWarehouseIdsForUser(user: SessionUser): string[] | undefined {
  if (hasGlobalWarehouseScope(user.role)) {
    return undefined;
  }
  const ids = assignedWarehouseIds(user);
  return ids;
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

/** Prisma filter on `PurchaseRequest.warehouseId`; empty for Admin (global). */
export function warehouseScopeForUser(
  user: SessionUser,
): { warehouseId: WarehouseIdFilter } | Record<string, never> {
  if (hasGlobalWarehouseScope(user.role)) {
    return {};
  }
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
  if (hasGlobalWarehouseScope(user.role)) {
    return {};
  }
  return { purchaseRequest: warehouseScopeForUser(user) };
}

export function goodsReceiptViaPoWarehouseWhere(
  user: SessionUser,
): Prisma.GoodsReceiptWhereInput {
  if (hasGlobalWarehouseScope(user.role)) {
    return {};
  }
  return { purchaseOrder: purchaseOrderViaPrWarehouseWhere(user) };
}

export function invoiceViaPoWarehouseWhere(user: SessionUser): Prisma.InvoiceWhereInput {
  if (hasGlobalWarehouseScope(user.role)) {
    return {};
  }
  return { purchaseOrder: purchaseOrderViaPrWarehouseWhere(user) };
}

export function nestedPurchaseRequestWarehouseScope(
  user: SessionUser,
): Prisma.PurchaseOrderWhereInput {
  if (hasGlobalWarehouseScope(user.role)) {
    return {};
  }
  const scope = warehouseScopeForUser(user);
  return "warehouseId" in scope ? { purchaseRequest: scope } : {};
}

export function nestedPurchaseOrderWarehouseScope(
  user: SessionUser,
): Prisma.GoodsReceiptWhereInput {
  if (hasGlobalWarehouseScope(user.role)) {
    return {};
  }
  const scope = warehouseScopeForUser(user);
  return "warehouseId" in scope
    ? { purchaseOrder: { purchaseRequest: scope } }
    : {};
}

/** PO list/detail filter from explicit scope ids (page loaders pass scopeWarehouseIdsForUser). */
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

/** Prisma filter on PR.warehouseId from explicit scope ids (undefined = global). */
export function prWarehouseWhereFromScopeIds(
  scopeWarehouseIds?: string[],
): Prisma.PurchaseRequestWhereInput {
  if (scopeWarehouseIds === undefined) {
    return {};
  }
  return { warehouseId: warehouseIdFilter(scopeWarehouseIds) };
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

/** Whether Ops Head / Central Team / Finance should pick warehouses in admin (multi-select). */
export function roleUsesMultiWarehouseAssignment(role: Role): boolean {
  return (
    role === Role.CENTRAL_TEAM ||
    role === Role.OPS_HEAD ||
    role === Role.FINANCE
  );
}

/** Whether the signed-in user may act on the given warehouse (fail closed when unassigned). */
export function userCanActForWarehouse(user: SessionUser, warehouseId: string): boolean {
  if (hasGlobalWarehouseScope(user.role)) {
    return true;
  }
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
  if (hasGlobalWarehouseScope(user.role)) {
    return { ok: true };
  }
  const ids = assignedWarehouseIds(user);
  if (ids.length === 0) {
    return { ok: false, message: NO_WAREHOUSE_ASSIGNED_MESSAGE };
  }
  if (!ids.includes(warehouseId)) {
    return { ok: false, message: WAREHOUSE_ACCESS_DENIED_MESSAGE };
  }
  return { ok: true };
}
