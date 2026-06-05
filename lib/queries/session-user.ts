import { Role } from "@/lib/prisma-enums";

import { prisma } from "@/lib/prisma";
import { roleUsesMultiWarehouseAssignment } from "@/lib/warehouse-scope";

export type AppSessionUserRecord = {
  role: Role;
  warehouseId: string | null;
  warehouseIds: string[];
};

/** Application user row used to resolve role + warehouse scope for the session. */
export async function getAppSessionUserRecord(
  userId: string,
): Promise<AppSessionUserRecord | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      warehouseId: true,
      warehouseAssignments: { select: { warehouseId: true } },
    },
  });
  if (!user) {
    return null;
  }

  const assignmentIds = user.warehouseAssignments.map((a) => a.warehouseId);
  const primaryWarehouseId = user.warehouseId ?? assignmentIds[0] ?? null;

  if (user.role === Role.SM) {
    return {
      role: user.role,
      warehouseId: primaryWarehouseId,
      warehouseIds: primaryWarehouseId ? [primaryWarehouseId] : [],
    };
  }

  if (roleUsesMultiWarehouseAssignment(user.role) || user.role === Role.ADMIN) {
    const warehouseIds =
      assignmentIds.length > 0
        ? assignmentIds
        : primaryWarehouseId
          ? [primaryWarehouseId]
          : [];
    return {
      role: user.role,
      warehouseId: primaryWarehouseId,
      warehouseIds,
    };
  }

  return {
    role: user.role,
    warehouseId: primaryWarehouseId,
    warehouseIds: [],
  };
}
