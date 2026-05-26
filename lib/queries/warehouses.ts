import { prisma } from "@/lib/prisma";

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

export async function getWarehouseOptions(): Promise<{ id: string; name: string }[]> {
  const rows = await prisma.warehouse.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows;
}

/** Warehouses the user may act on — from UserWarehouse, falling back to User.warehouseId. */
export async function getWarehousesAssignedToUser(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  const assignments = await prisma.userWarehouse.findMany({
    where: { userId },
    orderBy: { warehouse: { name: "asc" } },
    select: { warehouse: { select: { id: true, name: true } } },
  });
  if (assignments.length > 0) {
    return assignments.map((a) => a.warehouse);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { warehouse: { select: { id: true, name: true } } },
  });
  return user?.warehouse ? [user.warehouse] : [];
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
