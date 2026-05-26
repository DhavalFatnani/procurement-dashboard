import { Prisma, Role } from "@prisma/client";

import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export type UserListRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  warehouseId: string;
  warehouseIds: string[];
  warehouseNames: string[];
  /** Comma-separated warehouse labels for table display. */
  warehouseLabel: string;
  createdAt: string;
};

export type UserDetail = UserListRow;

export type UserFilters = {
  search?: string;
  role?: Role;
  warehouseId?: string;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

function mapUserRow(
  u: {
    id: string;
    email: string;
    name: string;
    role: Role;
    warehouseId: string;
    createdAt: Date;
    warehouse: { name: string };
    warehouseAssignments: { warehouse: { id: string; name: string } }[];
  },
): UserListRow {
  const assignments =
    u.warehouseAssignments.length > 0
      ? u.warehouseAssignments.map((a) => a.warehouse)
      : [{ id: u.warehouseId, name: u.warehouse.name }];
  const warehouseIds = assignments.map((w) => w.id);
  const warehouseNames = assignments.map((w) => w.name);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    warehouseId: u.warehouseId,
    warehouseIds,
    warehouseNames,
    warehouseLabel: warehouseNames.join(", "),
    createdAt: u.createdAt.toISOString(),
  };
}

const userInclude = {
  warehouse: { select: { name: true } },
  warehouseAssignments: {
    orderBy: { warehouse: { name: "asc" as const } },
    select: { warehouse: { select: { id: true, name: true } } },
  },
} satisfies Prisma.UserInclude;

export async function getUsers(filters: UserFilters): Promise<Paginated<UserListRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const clauses: Prisma.UserWhereInput[] = [];
  if (filters.search) {
    const q = filters.search.trim();
    clauses.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.role) {
    clauses.push({ role: filters.role });
  }
  if (filters.warehouseId) {
    clauses.push({
      warehouseAssignments: { some: { warehouseId: filters.warehouseId } },
    });
  }
  const where: Prisma.UserWhereInput = clauses.length > 0 ? { AND: clauses } : {};

  return paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount,
    findMany: ({ skip, take }) =>
      prisma.user
        .findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: userInclude,
        })
        .then((rows) => rows.map(mapUserRow)),
    count: () => prisma.user.count({ where }),
  });
}

export async function getUserById(id: string): Promise<UserDetail | null> {
  const u = await prisma.user.findUnique({
    where: { id },
    include: userInclude,
  });
  if (!u) return null;
  return mapUserRow(u);
}

export async function syncUserWarehouseAssignments(
  userId: string,
  warehouseIds: string[],
  primaryWarehouseId: string,
): Promise<void> {
  const uniqueIds = [...new Set(warehouseIds)];
  await prisma.$transaction([
    prisma.userWarehouse.deleteMany({ where: { userId } }),
    prisma.userWarehouse.createMany({
      data: uniqueIds.map((warehouseId) => ({ userId, warehouseId })),
    }),
    prisma.user.update({
      where: { id: userId },
      data: { warehouseId: primaryWarehouseId },
    }),
  ]);
}
