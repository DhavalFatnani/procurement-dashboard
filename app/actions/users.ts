"use server";

import { Role, UserStatus } from "@/lib/prisma-enums";
import { revalidatePath } from "next/cache";

import type { MutationResult } from "@/lib/action-result";
import {
  ADMIN_MASTER_DATA_ROLES,
  ADMIN_ONLY_ROLES,
  canAssignAdminRole,
} from "@/lib/admin-access";
import { logger } from "@/lib/logger";
import type { Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import {
  getUserById as getUserByIdQuery,
  getUsers as getUsersQuery,
  syncUserWarehouseAssignments,
  userHasProcurementActivity,
} from "@/lib/queries/users";
import type { UserDetail, UserFilters, UserListRow } from "@/lib/queries/users";
import { revalidateInboxCache } from "@/lib/revalidate-tags";
import { ActionAuthError, requireRoles } from "@/lib/server-action-guard";
import {
  generateAdminRecoveryLink,
  sendPasswordResetEmail,
} from "@/lib/auth-recovery-link";
import { tryCreateSecretSupabaseClient } from "@/lib/supabase-admin";
import { roleUsesMultiWarehouseAssignment } from "@/lib/warehouse-scope";

async function guardAdminMasterData(): Promise<MutationResult | null> {
  try {
    await requireRoles([...ADMIN_MASTER_DATA_ROLES]);
    return null;
  } catch (err) {
    if (err instanceof ActionAuthError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }
}

export async function getUsers(
  filters: UserFilters,
): Promise<Paginated<UserListRow>> {
  const authErr = await guardAdminMasterData();
  if (authErr) {
    return {
      items: [],
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 25,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
    };
  }
  return getUsersQuery(filters);
}

export async function getUserById(id: string): Promise<UserDetail | null> {
  const authErr = await guardAdminMasterData();
  if (authErr) return null;
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
  /** Optional initial password. When omitted, a password-reset email is sent. */
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
  if (role === Role.ADMIN) {
    const warehouseId = input.warehouseId?.trim() ?? input.warehouseIds?.[0]?.trim();
    if (!warehouseId) {
      return { ok: false, message: "Home warehouse is required for Admin users." };
    }
    return { ok: true, warehouseIds: [warehouseId], primaryWarehouseId: warehouseId };
  }
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

function authAppMetadata(
  role: Role,
  warehouseIds: string[],
  primaryWarehouseId: string,
  active: boolean,
): Record<string, string | string[] | boolean> {
  return {
    role,
    active,
    ...warehouseAppMetadata(role, warehouseIds, primaryWarehouseId),
  };
}

async function guardNotSelf(
  targetUserId: string,
): Promise<MutationResult | null> {
  const actor = await requireRoles([...ADMIN_MASTER_DATA_ROLES]);
  if (actor.id === targetUserId) {
    return { ok: false, message: "You cannot perform this action on your own account." };
  }
  return null;
}

async function guardDeleteUser(
  targetUserId: string,
): Promise<MutationResult | null> {
  try {
    const actor = await requireRoles([...ADMIN_ONLY_ROLES]);
    if (actor.id === targetUserId) {
      return { ok: false, message: "You cannot perform this action on your own account." };
    }
    return null;
  } catch (err) {
    if (err instanceof ActionAuthError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }
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
  const authErr = await guardAdminMasterData();
  if (authErr) return authErr;

  try {
    const error = validateUserInput(input);
    if (error) return { ok: false, message: error };

    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const { role, password } = input;

    const actor = await requireRoles([...ADMIN_MASTER_DATA_ROLES]);
    if (role === Role.ADMIN && !canAssignAdminRole(actor.role)) {
      return { ok: false, message: "Only Admin users can assign the Admin role." };
    }

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
      app_metadata: authAppMetadata(role, warehouseIds, primaryWarehouseId, true),
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
    let message: string | undefined;
    if (!password) {
      const emailResult = await sendPasswordResetEmail(email);
      if (emailResult.ok) {
        message = `User created. Password setup email sent to ${email}.`;
      } else {
        logger.warn(
          { email, message: emailResult.message },
          "User created but password reset email failed — falling back to manual link",
        );
        const linkResult = await generateAdminRecoveryLink(email);
        if (!linkResult.ok) {
          return {
            ok: true,
            userId,
            message:
              "User created, but the setup email could not be sent and no recovery link was generated. Use Reset password in the users table.",
          };
        }
        recoveryLink = linkResult.link;
        message = `User created, but email could not be sent (${emailResult.message}). Copy the recovery link and share it manually.`;
      }
    }

    revalidatePath("/admin/users");
    revalidateInboxCache();
    return {
      ok: true,
      userId,
      recoveryLink,
      message,
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
  const authErr = await guardAdminMasterData();
  if (authErr) return authErr;

  const existing = await prisma.user.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
      warehouseId: true,
      warehouseAssignments: { select: { warehouseId: true } },
    },
  });
  if (!existing) return { ok: false, message: "User not found." };

  const name = input.name?.trim() ?? existing.name;
  const role = input.role ?? existing.role;

  const actor = await requireRoles([...ADMIN_MASTER_DATA_ROLES]);
  if (
    (role === Role.ADMIN || existing.role === Role.ADMIN) &&
    !canAssignAdminRole(actor.role)
  ) {
    return { ok: false, message: "Only Admin users can manage Admin accounts." };
  }

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
  const active = existing.status === UserStatus.ACTIVE;
  const { error: updateErr } = await admin.client.auth.admin.updateUserById(
    existing.id,
    {
      user_metadata: { name, role },
      app_metadata: authAppMetadata(role, warehouseIds, primaryWarehouseId, active),
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

export async function deactivateUser(userId: string): Promise<MutationResult> {
  const selfErr = await guardNotSelf(userId);
  if (selfErr) return selfErr;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      warehouseId: true,
      warehouseAssignments: { select: { warehouseId: true } },
    },
  });
  if (!user) return { ok: false, message: "User not found." };
  if (user.status === UserStatus.INACTIVE) {
    return { ok: false, message: "User is already inactive." };
  }

  const warehouseIds =
    user.warehouseAssignments.length > 0
      ? user.warehouseAssignments.map((a) => a.warehouseId)
      : [user.warehouseId];

  const admin = tryCreateSecretSupabaseClient();
  if (!admin.ok) {
    return { ok: false, message: admin.message };
  }

  const { error: banErr } = await admin.client.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
    app_metadata: authAppMetadata(
      user.role,
      warehouseIds,
      user.warehouseId,
      false,
    ),
  });
  if (banErr) {
    return {
      ok: false,
      message: banErr.message ?? "Could not deactivate Supabase user.",
    };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.INACTIVE },
    });
  } catch (err) {
    logger.error({ err, userId }, "deactivateUser prisma failed");
    return { ok: false, message: "Failed to deactivate user." };
  }

  revalidatePath("/admin/users");
  revalidateInboxCache();
  return { ok: true };
}

export async function reactivateUser(userId: string): Promise<MutationResult> {
  const authErr = await guardAdminMasterData();
  if (authErr) return authErr;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
      warehouseId: true,
      warehouseAssignments: { select: { warehouseId: true } },
    },
  });
  if (!user) return { ok: false, message: "User not found." };
  if (user.status === UserStatus.ACTIVE) {
    return { ok: false, message: "User is already active." };
  }

  const warehouseIds =
    user.warehouseAssignments.length > 0
      ? user.warehouseAssignments.map((a) => a.warehouseId)
      : [user.warehouseId];

  const admin = tryCreateSecretSupabaseClient();
  if (!admin.ok) {
    return { ok: false, message: admin.message };
  }

  const { error: unbanErr } = await admin.client.auth.admin.updateUserById(userId, {
    ban_duration: "none",
    app_metadata: authAppMetadata(
      user.role,
      warehouseIds,
      user.warehouseId,
      true,
    ),
  });
  if (unbanErr) {
    return {
      ok: false,
      message: unbanErr.message ?? "Could not reactivate Supabase user.",
    };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
  } catch (err) {
    logger.error({ err, userId }, "reactivateUser prisma failed");
    return { ok: false, message: "Failed to reactivate user." };
  }

  revalidatePath("/admin/users");
  revalidateInboxCache();
  return { ok: true };
}

export async function deleteUser(userId: string): Promise<MutationResult> {
  const authErr = await guardDeleteUser(userId);
  if (authErr) return authErr;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return { ok: false, message: "User not found." };

  if (await userHasProcurementActivity(userId)) {
    return {
      ok: false,
      message:
        "This user has procurement history. Deactivate the account instead of deleting it.",
    };
  }

  const admin = tryCreateSecretSupabaseClient();
  if (!admin.ok) {
    return { ok: false, message: admin.message };
  }

  const { error: deleteAuthErr } = await admin.client.auth.admin.deleteUser(userId);
  if (deleteAuthErr) {
    return {
      ok: false,
      message: deleteAuthErr.message ?? "Could not delete Supabase user.",
    };
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (err) {
    logger.error({ err, userId }, "deleteUser prisma failed");
    return {
      ok: false,
      message: "Auth user removed but database record could not be deleted.",
    };
  }

  revalidatePath("/admin/users");
  revalidateInboxCache();
  return { ok: true };
}

export async function sendPasswordReset(
  userId: string,
): Promise<MutationResult & { recoveryLink?: string }> {
  const authErr = await guardAdminMasterData();
  if (authErr) return authErr;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, status: true },
  });
  if (!user) return { ok: false, message: "User not found." };
  if (user.status === UserStatus.INACTIVE) {
    return {
      ok: false,
      message: "Reactivate the user before sending a password reset.",
    };
  }

  const emailResult = await sendPasswordResetEmail(user.email);
  if (emailResult.ok) {
    return {
      ok: true,
      message: `Password reset email sent to ${user.email}.`,
    };
  }

  const linkResult = await generateAdminRecoveryLink(user.email);
  if (!linkResult.ok) {
    return {
      ok: false,
      message: `${emailResult.message} Could not generate a recovery link either.`,
    };
  }

  return {
    ok: true,
    recoveryLink: linkResult.link,
    message: `Email could not be sent (${emailResult.message}). Copy the recovery link and share it with ${user.email}.`,
  };
}
