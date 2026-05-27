import "server-only";

import { prisma } from "@/lib/prisma";
import { getWarehousesAssignedToUser } from "@/lib/queries/warehouses";
import type { SessionUser } from "@/lib/session";
import {
  assertSessionCanAccessWarehouse,
  NO_WAREHOUSE_ASSIGNED_MESSAGE,
  WAREHOUSE_ACCESS_DENIED_MESSAGE,
} from "@/lib/warehouse-scope";

export type WarehouseAccessResult = { ok: true } | { ok: false; message: string };

export async function assertUserWarehouseAccess(
  userId: string,
  warehouseId: string,
): Promise<WarehouseAccessResult> {
  const assigned = await getWarehousesAssignedToUser(userId);
  if (assigned.length === 0) {
    return { ok: false, message: NO_WAREHOUSE_ASSIGNED_MESSAGE };
  }
  if (!assigned.some((w) => w.id === warehouseId)) {
    return { ok: false, message: WAREHOUSE_ACCESS_DENIED_MESSAGE };
  }
  return { ok: true };
}

export async function assertPurchaseRequestAccess(
  userId: string,
  prId: string,
): Promise<WarehouseAccessResult> {
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: { warehouseId: true },
  });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }
  return assertUserWarehouseAccess(userId, pr.warehouseId);
}

export async function assertPurchaseOrderAccess(
  userId: string,
  poId: string,
): Promise<WarehouseAccessResult> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { purchaseRequest: { select: { warehouseId: true } } },
  });
  if (!po) {
    return { ok: false, message: "Purchase order not found." };
  }
  return assertUserWarehouseAccess(userId, po.purchaseRequest.warehouseId);
}

export async function assertInvoiceAccess(
  userId: string,
  invoiceId: string,
): Promise<WarehouseAccessResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      purchaseOrder: { select: { purchaseRequest: { select: { warehouseId: true } } } },
    },
  });
  if (!invoice) {
    return { ok: false, message: "Invoice not found." };
  }
  return assertUserWarehouseAccess(userId, invoice.purchaseOrder.purchaseRequest.warehouseId);
}

export async function assertGrnAccess(
  userId: string,
  grnId: string,
): Promise<WarehouseAccessResult> {
  const grn = await prisma.goodsReceipt.findUnique({
    where: { id: grnId },
    select: {
      purchaseOrder: { select: { purchaseRequest: { select: { warehouseId: true } } } },
    },
  });
  if (!grn) {
    return { ok: false, message: "Goods receipt not found." };
  }
  return assertUserWarehouseAccess(userId, grn.purchaseOrder.purchaseRequest.warehouseId);
}

/** Session + DB guard for mutations (prefers JWT scope, falls back to DB assignments). */
export async function assertSessionPurchaseRequestAccess(
  user: SessionUser,
  prId: string,
): Promise<WarehouseAccessResult> {
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: { warehouseId: true },
  });
  if (!pr) {
    return { ok: false, message: "Purchase request not found." };
  }
  const sessionCheck = assertSessionCanAccessWarehouseFromUser(user, pr.warehouseId);
  if (!sessionCheck.ok) {
    return sessionCheck;
  }
  return assertUserWarehouseAccess(user.id, pr.warehouseId);
}

export async function assertSessionPurchaseOrderAccess(
  user: SessionUser,
  poId: string,
): Promise<WarehouseAccessResult> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { purchaseRequest: { select: { warehouseId: true } } },
  });
  if (!po) {
    return { ok: false, message: "Purchase order not found." };
  }
  const sessionCheck = assertSessionCanAccessWarehouseFromUser(
    user,
    po.purchaseRequest.warehouseId,
  );
  if (!sessionCheck.ok) {
    return sessionCheck;
  }
  return assertUserWarehouseAccess(user.id, po.purchaseRequest.warehouseId);
}

export async function assertSessionInvoiceAccess(
  user: SessionUser,
  invoiceId: string,
): Promise<WarehouseAccessResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      purchaseOrder: { select: { purchaseRequest: { select: { warehouseId: true } } } },
    },
  });
  if (!invoice) {
    return { ok: false, message: "Invoice not found." };
  }
  const warehouseId = invoice.purchaseOrder.purchaseRequest.warehouseId;
  const sessionCheck = assertSessionCanAccessWarehouseFromUser(user, warehouseId);
  if (!sessionCheck.ok) {
    return sessionCheck;
  }
  return assertUserWarehouseAccess(user.id, warehouseId);
}

export async function assertSessionGrnAccess(
  user: SessionUser,
  grnId: string,
): Promise<WarehouseAccessResult> {
  const grn = await prisma.goodsReceipt.findUnique({
    where: { id: grnId },
    select: {
      purchaseOrder: { select: { purchaseRequest: { select: { warehouseId: true } } } },
    },
  });
  if (!grn) {
    return { ok: false, message: "Goods receipt not found." };
  }
  const warehouseId = grn.purchaseOrder.purchaseRequest.warehouseId;
  const sessionCheck = assertSessionCanAccessWarehouseFromUser(user, warehouseId);
  if (!sessionCheck.ok) {
    return sessionCheck;
  }
  return assertUserWarehouseAccess(user.id, warehouseId);
}

function assertSessionCanAccessWarehouseFromUser(
  user: SessionUser,
  warehouseId: string,
): WarehouseAccessResult {
  return assertSessionCanAccessWarehouse(user, warehouseId);
}
