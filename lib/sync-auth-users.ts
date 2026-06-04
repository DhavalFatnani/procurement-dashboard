import type { User } from "@supabase/supabase-js";
import type { PrismaClient } from "@/lib/prisma-client";
import { Role } from "@/lib/prisma-enums";

import { roleUsesMultiWarehouseAssignment, warehouseIdsFromMetadata } from "@/lib/warehouse-scope";
import { isRole } from "@/types";

export type SyncAuthUsersResult = {
  synced: { id: string; email: string; created: boolean }[];
  skipped: { id: string; email: string | null; reason: string }[];
};

function roleFromAuthUser(user: User): Role | null {
  const raw = user.user_metadata?.role ?? user.app_metadata?.role;
  return isRole(raw) ? raw : null;
}

function nameFromAuthUser(user: User): string {
  const meta = user.user_metadata?.name;
  if (typeof meta === "string" && meta.trim()) {
    return meta.trim();
  }
  if (user.email) {
    return user.email.split("@")[0] ?? user.email;
  }
  return "User";
}

function warehouseIdsFromAuthUser(user: User): string[] {
  const fromList = warehouseIdsFromMetadata(
    (user.app_metadata ?? {}) as Record<string, unknown>,
  );
  if (fromList.length > 0) {
    return fromList;
  }
  const single = user.app_metadata?.warehouseId;
  if (typeof single === "string" && single.length > 0) {
    return [single];
  }
  return [];
}

async function applyWarehouseAssignments(
  prisma: PrismaClient,
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

/**
 * Mirrors Supabase Auth users into the Prisma `User` table (and warehouse
 * assignments). Existing rows are updated by auth user id; nothing is deleted.
 */
export async function syncAuthUsersToDatabase(
  prisma: PrismaClient,
  authUsers: User[],
): Promise<SyncAuthUsersResult> {
  const warehouses = await prisma.warehouse.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const defaultWarehouseId = warehouses[0]?.id ?? null;

  const result: SyncAuthUsersResult = { synced: [], skipped: [] };

  for (const authUser of authUsers) {
    const email = authUser.email?.trim().toLowerCase() ?? null;
    if (!email) {
      result.skipped.push({
        id: authUser.id,
        email: null,
        reason: "No email on auth user",
      });
      continue;
    }

    const role = roleFromAuthUser(authUser);
    if (!role) {
      result.skipped.push({
        id: authUser.id,
        email,
        reason: "Missing or invalid role in user_metadata / app_metadata",
      });
      continue;
    }

    let warehouseIds = warehouseIdsFromAuthUser(authUser);
    if (warehouseIds.length === 0) {
      if (!defaultWarehouseId) {
        result.skipped.push({
          id: authUser.id,
          email,
          reason: "No warehouse in metadata and no warehouses in database",
        });
        continue;
      }
      warehouseIds = [defaultWarehouseId];
    }

    const existingWarehouses = await prisma.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { id: true },
    });
    if (existingWarehouses.length !== warehouseIds.length) {
      result.skipped.push({
        id: authUser.id,
        email,
        reason: "One or more warehouse ids from auth metadata do not exist",
      });
      continue;
    }

    if (role === Role.SM && warehouseIds.length > 1) {
      warehouseIds = [warehouseIds[0]!];
    }

    const primaryWarehouseId = warehouseIds[0]!;
    const name = nameFromAuthUser(authUser);

    const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
    await prisma.user.upsert({
      where: { id: authUser.id },
      create: {
        id: authUser.id,
        email,
        name,
        role,
        warehouseId: primaryWarehouseId,
      },
      update: {
        email,
        name,
        role,
      },
    });

    if (
      roleUsesMultiWarehouseAssignment(role) ||
      warehouseIds.length > 1 ||
      existing?.warehouseId !== primaryWarehouseId ||
      !existing
    ) {
      await applyWarehouseAssignments(
        prisma,
        authUser.id,
        warehouseIds,
        primaryWarehouseId,
      );
    }

    result.synced.push({
      id: authUser.id,
      email,
      created: !existing,
    });
  }

  return result;
}
