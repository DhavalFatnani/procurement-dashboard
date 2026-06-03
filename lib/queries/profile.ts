import { Role } from "@/lib/prisma-enums";

import { prisma } from "@/lib/prisma";

export type UserProfileWarehouse = {
  id: string;
  name: string;
  location: string;
  isPrimary: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  warehouses: UserProfileWarehouse[];
};

export async function getCurrentUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      warehouse: { select: { id: true, name: true, location: true } },
      warehouseAssignments: {
        orderBy: { warehouse: { name: "asc" } },
        select: { warehouse: { select: { id: true, name: true, location: true } } },
      },
    },
  });
  if (!user) {
    return null;
  }

  const assignments =
    user.warehouseAssignments.length > 0
      ? user.warehouseAssignments.map((a) => a.warehouse)
      : user.warehouse
        ? [user.warehouse]
        : [];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    warehouses: assignments.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      location: warehouse.location,
      isPrimary: warehouse.id === user.warehouseId,
    })),
  };
}
