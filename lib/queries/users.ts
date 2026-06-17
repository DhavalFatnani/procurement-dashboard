import { Prisma, Role, UserStatus } from "@/lib/prisma-client";

import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { dbSerial } from "@/lib/db-serial";
import { formatWarehouseLabel } from "@/lib/format-warehouse";

export type UserListRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
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
  status?: UserStatus;
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
    status: UserStatus;
    warehouseId: string;
    createdAt: Date;
    warehouse: { name: string; location: string };
    warehouseAssignments: { warehouse: { id: string; name: string; location: string } }[];
  },
): UserListRow {
  const assignments =
    u.warehouseAssignments.length > 0
      ? [...u.warehouseAssignments.map((a) => a.warehouse)].sort((a, b) =>
          a.name.localeCompare(b.name),
        )
      : [{ id: u.warehouseId, name: u.warehouse.name, location: u.warehouse.location }];
  const warehouseIds = assignments.map((w) => w.id);
  const warehouseNames = assignments.map((w) =>
    formatWarehouseLabel(w.name, w.location),
  );
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    warehouseId: u.warehouseId,
    warehouseIds,
    warehouseNames,
    warehouseLabel: warehouseNames.join(", "),
    createdAt: u.createdAt.toISOString(),
  };
}

const userListSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  warehouseId: true,
  createdAt: true,
  warehouse: { select: { name: true, location: true } },
  warehouseAssignments: {
    select: {
      warehouse: { select: { id: true, name: true, location: true } },
    },
  },
} satisfies Prisma.UserSelect;

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
  if (filters.status) {
    clauses.push({ status: filters.status });
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
          select: userListSelect,
        })
        .then((rows) => rows.map(mapUserRow)),
    count: () => prisma.user.count({ where }),
  });
}

export async function getUserById(id: string): Promise<UserDetail | null> {
  const u = await prisma.user.findUnique({
    where: { id },
    select: userListSelect,
  });
  if (!u) return null;
  return mapUserRow(u);
}

/** True when the user is referenced by procurement records (blocks hard delete). */
export async function userHasProcurementActivity(userId: string): Promise<boolean> {
  const checks = await dbSerial(
    () => prisma.vendor.count({ where: { createdById: userId } }),
    () => prisma.vendorChangeLog.count({ where: { changedById: userId } }),
    () =>
      prisma.vendorRequest.count({
        where: { OR: [{ requestedById: userId }, { reviewedById: userId }] },
      }),
    () =>
      prisma.catalogItem.count({
        where: {
          OR: [{ createdById: userId }, { approvedById: userId }],
        },
      }),
    () => prisma.purchaseRequest.count({ where: { createdById: userId } }),
    () => prisma.pRVersion.count({ where: { changedById: userId } }),
    () => prisma.purchaseOrder.count({ where: { forceClosedById: userId } }),
    () => prisma.goodsReceipt.count({ where: { receivedById: userId } }),
    () => prisma.gRNException.count({ where: { resolvedById: userId } }),
    () =>
      prisma.invoice.count({
        where: {
          OR: [{ uploadedById: userId }, { overrideById: userId }],
        },
      }),
    () => prisma.payment.count({ where: { paidById: userId } }),
    () =>
      prisma.pOAdvanceRequest.count({
        where: { OR: [{ requestedById: userId }, { reviewedById: userId }] },
      }),
    () => prisma.pOAdvancePayment.count({ where: { paidById: userId } }),
    () => prisma.purchaseOrderLineAdjustment.count({ where: { createdById: userId } }),
    () => prisma.serialReservation.count({ where: { createdById: userId } }),
    () => prisma.seriesConfig.count({ where: { configuredById: userId } }),
    () => prisma.catalogItemVendor.count({ where: { linkedById: userId } }),
    () => prisma.vendorCatalogItemPrice.count({ where: { recordedById: userId } }),
  );
  return checks.some((count) => count > 0);
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
