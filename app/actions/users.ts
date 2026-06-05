"use server";

import { Role } from "@/lib/prisma-enums";
import { revalidatePath } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  getUserById as getUserByIdQuery,
  getUsers as getUsersQuery,
  syncUserWarehouseAssignments,
} from "@/lib/queries/users";
import type { UserDetail, UserFilters, UserListRow } from "@/lib/queries/users";
import { revalidateInboxCache } from "@/lib/revalidate-tags";
import { ActionAuthError, requireRoles } from "@/lib/server-action-guard";
import { generateAdminRecoveryLink } from "@/lib/auth-recovery-link";
import { tryCreateSecretSupabaseClient } from "@/lib/supabase-admin";
import { roleUsesMultiWarehouseAssignment } from "@/lib/warehouse-scope";

export async function getUsers(
  filters: UserFilters,
): Promise<Paginated<UserListRow>> {
  await requireRoles([Role.OPS_HEAD]);
  return getUsersQuery(filters);
}

export async function getUserById(id: string): Promise<UserDetail | null> {
  await requireRoles([Role.OPS_HEAD]);
  return getUserByIdQuery(id);
}

export type CreateUserInput = {
  email: string;
  name: string;
  role: Role;
  /** Required for SM — single warehouse. */
  warehouseId?: string;
  /** Required for Ops Head / Finance — one or more warehouses. */
  warehouseIds?: string[];
  /** Optional initial password. When omitted, a password-reset link is sent. */
  password?: string;
};

export type UpdateUserInput = {
  id: string;
  name?: string;
  role?: Role;
  warehouseId?: string;
  warehouseIds?: string[];
};

function resolveWarehouseSelection(
  role: Role,
  input: { warehouseId?: string; warehouseIds?: string[] },
): { ok: true; warehouseIds: string[]; primaryWarehouseId: string } | { ok: false; message: string } {
  if (roleUsesMultiWarehouseAssignment(role)) {
    const ids = [...new Set((input.warehouseIds ?? []).filter(Boolean))];
    if (ids.length === 0) {
      return { ok: false, message: "Select at least one warehouse." };
    }
    return { ok: true, warehouseIds: ids, primaryWarehouseId: ids[0]! };
  }

  const warehouseId = input.warehouseId?.trim();
  if (!warehouseId) {
    return { ok: false, message: "Warehouse is required." };
  }
  return { ok: true, warehouseIds: [warehouseId], primaryWarehouseId: warehouseId };
}

function warehouseAppMetadata(
  role: Role,
  warehouseIds: string[],
  primaryWarehouseId: string,
): Record<string, string | string[]> {
  if (role === Role.SM) {
    return { warehouseId: primaryWarehouseId };
  }
  if (roleUsesMultiWarehouseAssignment(role)) {
    return { warehouseId: primaryWarehouseId, warehouseIds };
  }
  return {};
}

async function validateWarehousesExist(warehouseIds: string[]): Promise<string | null> {
  const found = await prisma.warehouse.findMany({
    where: { id: { in: warehouseIds } },
    select: { id: true },
  });
  if (found.length !== warehouseIds.length) {
    return "One or more selected warehouses do not exist.";
  }
  return null;
}

function validateUserInput(input: CreateUserInput): string | null {
  if (!input.email.trim()) return "Email is required.";
  if (!/.+@.+\..+/.test(input.email.trim())) return "Email looks invalid.";
  if (!input.name.trim()) return "Name is required.";
  if (input.password && input.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export async function createUser(
  input: CreateUserInput,
): Promise<MutationResult & { userId?: string; recoveryLink?: string }> {
  try {
    await requireRoles([Role.OPS_HEAD]);
  } catch (err) {
    if (err instanceof ActionAuthError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }

  try {
    const error = validateUserInput(input);
    if (error) return { ok: false, message: error };

    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const { role, password } = input;

    const warehouses = resolveWarehouseSelection(role, input);
    if (!warehouses.ok) return { ok: false, message: warehouses.message };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, message: "A user with this email already exists." };
    }

    const warehouseErr = await validateWarehousesExist(warehouses.warehouseIds);
    if (warehouseErr) return { ok: false, message: warehouseErr };

    const admin = tryCreateSecretSupabaseClient();
    if (!admin.ok) {
      return { ok: false, message: admin.message };
    }
    const supabase = admin.client;
    const { warehouseIds, primaryWarehouseId } = warehouses;

    const { data, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: { name, role, must_change_password: true },
      app_metadata: {
        role,
        ...warehouseAppMetadata(role, warehouseIds, primaryWarehouseId),
      },
    });

    if (createErr || !data.user) {
      return {
        ok: false,
        message: createErr?.message ?? "Could not create Supabase user.",
      };
    }

    const userId = data.user.id;

    try {
      await prisma.user.create({
        data: {
          id: userId,
          email,
          name,
          role,
          warehouseId: primaryWarehouseId,
          warehouseAssignments: {
            create: warehouseIds.map((warehouseId) => ({ warehouseId })),
          },
        },
      });
    } catch (e) {
      logger.error(
        { err: e instanceof Error ? e.message : String(e), userId, email },
        "User created in Supabase but Prisma mirror failed — rolling back",
      );
      await supabase.auth.admin.deleteUser(userId).catch((delErr) => {
        logger.error(
          { err: delErr instanceof Error ? delErr.message : String(delErr) },
          "Failed to roll back Supabase user after Prisma failure",
        );
      });
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Failed to mirror user to DB.",
      };
    }

    let recoveryLink: string | undefined;
    if (!password) {
      const linkResult = await generateAdminRecoveryLink(email);
      if (!linkResult.ok) {
        logger.warn(
          { email, message: linkResult.message },
          "User created but recovery link generation failed",
        );
        return {
          ok: true,
          userId,
          message:
            "User created, but the recovery link could not be generated. Use Reset password in the users table.",
        };
      }
      recoveryLink = linkResult.link;
    }

    revalidatePath("/admin/users");
    revalidateInboxCache();
    return {
      ok: true,
      userId,
      recoveryLink,
      message: recoveryLink
        ? "User created — copy the recovery link and share it with them."
        : undefined,
    };
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "createUser failed",
    );
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Could not create user. Check server logs for details.",
    };
  }
}

export async function updateUser(input: UpdateUserInput): Promise<MutationResult> {
  await requireRoles([Role.OPS_HEAD]);

  const existing = await prisma.user.findUnique({
    where: { id: input.id },
    include: {
      warehouseAssignments: { select: { warehouseId: true } },
    },
  });
  if (!existing) return { ok: false, message: "User not found." };

  const name = input.name?.trim() ?? existing.name;
  const role = input.role ?? existing.role;

  if (!name) return { ok: false, message: "Name is required." };

  const fallbackIds =
    existing.warehouseAssignments.length > 0
      ? existing.warehouseAssignments.map((a) => a.warehouseId)
      : [existing.warehouseId];

  const warehouses = resolveWarehouseSelection(role, {
    warehouseId: input.warehouseId ?? existing.warehouseId,
    warehouseIds: input.warehouseIds ?? fallbackIds,
  });
  if (!warehouses.ok) return { ok: false, message: warehouses.message };

  const warehouseErr = await validateWarehousesExist(warehouses.warehouseIds);
  if (warehouseErr) return { ok: false, message: warehouseErr };

  const { warehouseIds, primaryWarehouseId } = warehouses;

  const admin = tryCreateSecretSupabaseClient();
  if (!admin.ok) {
    return { ok: false, message: admin.message };
  }
  const { error: updateErr } = await admin.client.auth.admin.updateUserById(
    existing.id,
    {
      user_metadata: { name, role },
      app_metadata: {
        role,
        ...warehouseAppMetadata(role, warehouseIds, primaryWarehouseId),
      },
    },
  );

  if (updateErr) {
    return {
      ok: false,
      message: updateErr.message ?? "Could not update Supabase user.",
    };
  }

  await syncUserWarehouseAssignments(existing.id, warehouseIds, primaryWarehouseId);
  await prisma.user.update({
    where: { id: existing.id },
    data: { name, role },
  });

  revalidatePath("/admin/users");
  revalidateInboxCache();
  return { ok: true };
}

export async function sendPasswordReset(
  userId: string,
): Promise<MutationResult & { recoveryLink?: string }> {
  await requireRoles([Role.OPS_HEAD]);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return { ok: false, message: "User not found." };

  const linkResult = await generateAdminRecoveryLink(user.email);
  if (!linkResult.ok) {
    return { ok: false, message: linkResult.message };
  }

  return {
    ok: true,
    recoveryLink: linkResult.link,
    message: `Recovery link ready for ${user.email}. Copy and share it with the user.`,
  };
}
