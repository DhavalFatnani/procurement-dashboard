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
