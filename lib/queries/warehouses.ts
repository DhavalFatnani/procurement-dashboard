import { prisma } from "@/lib/prisma";
import {
  type WarehouseOption,
  warehouseOptionsFromRows,
} from "@/lib/format-warehouse";

export type { WarehouseOption } from "@/lib/format-warehouse";

export type WarehouseRow = {
  id: string;
  name: string;
  location: string;
  userCount: number;
  createdAt: string;
};

export async function getWarehouses(): Promise<WarehouseRow[]> {
  const rows = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });
  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    location: w.location,
    userCount: w._count.users,
    createdAt: w.createdAt.toISOString(),
  }));
}

export async function getWarehouseOptions(): Promise<WarehouseOption[]> {
  const rows = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, location: true },
  });
  return warehouseOptionsFromRows(rows);
}

/** Warehouses the user may act on — from UserWarehouse, falling back to User.warehouseId. */
export async function getWarehousesAssignedToUser(
  userId: string,
): Promise<WarehouseOption[]> {
  const assignments = await prisma.userWarehouse.findMany({
    where: { userId },
    orderBy: { warehouse: { name: "asc" } },
    select: { warehouse: { select: { id: true, name: true, location: true } } },
  });
  if (assignments.length > 0) {
    return warehouseOptionsFromRows(assignments.map((a) => a.warehouse));
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { warehouse: { select: { id: true, name: true, location: true } } },
  });
  return user?.warehouse ? warehouseOptionsFromRows([user.warehouse]) : [];
}

export async function getWarehouseById(id: string): Promise<WarehouseRow | null> {
  const w = await prisma.warehouse.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!w) return null;
  return {
    id: w.id,
    name: w.name,
    location: w.location,
    userCount: w._count.users,
    createdAt: w.createdAt.toISOString(),
  };
}
