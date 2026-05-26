import "server-only";

import { getWarehousesAssignedToUser } from "@/lib/queries/warehouses";

export async function assertUserWarehouseAccess(
  userId: string,
  warehouseId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const assigned = await getWarehousesAssignedToUser(userId);
  if (assigned.length === 0) {
    return { ok: false, message: "Your profile has no warehouse assigned." };
  }
  if (!assigned.some((w) => w.id === warehouseId)) {
    return { ok: false, message: "You are not assigned to that warehouse." };
  }
  return { ok: true };
}
