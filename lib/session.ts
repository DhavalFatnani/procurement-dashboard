import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@/lib/prisma-enums";

import { getVerifiedIdentity } from "@/lib/auth-claims";
import { identityFromHeaders, warehouseIdFromMetadata } from "@/lib/auth-headers";
import { getAppSessionUserRecord } from "@/lib/queries/session-user";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Role as AppRole } from "@/types";
import { isRole } from "@/types";
import {
  warehouseIdsFromMetadata,
  roleUsesMultiWarehouseAssignment,
} from "@/lib/warehouse-scope";

export type SessionUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  role: AppRole;
  /** Primary warehouse — SM single scope; first assigned warehouse for Ops Head / Finance. */
  warehouseId: string | null;
  /** All assigned warehouses for Ops Head / Finance / Admin (from app User row when present). */
  warehouseIds: string[];
};

function roleFromMetadata(
  userMetadata: Record<string, unknown>,
  appMetadata: Record<string, unknown>,
): AppRole | null {
  const raw = userMetadata.role ?? appMetadata.role;
  return isRole(raw) ? raw : null;
}

async function fetchRequestSession(): Promise<SessionUser | null> {
  const headerStore = await headers();
  let identity = identityFromHeaders(headerStore);

  if (!identity) {
    const supabase = await createServerSupabaseClient();
    identity = await getVerifiedIdentity(supabase);
  }

  if (!identity) {
    return null;
  }

  const appUser = await getAppSessionUserRecord(identity.id);

  const role =
    appUser?.role ?? roleFromMetadata(identity.userMetadata, identity.appMetadata);
  if (!role) {
    return null;
  }

  const metadataWarehouseId = warehouseIdFromMetadata(identity.appMetadata);
  const metadataWarehouseIds = warehouseIdsFromMetadata(identity.appMetadata);

  let warehouseId: string | null = null;
  let warehouseIds: string[] = [];

  if (appUser) {
    warehouseId = appUser.warehouseId;
    warehouseIds = appUser.warehouseIds;
  } else if (role === Role.SM) {
    warehouseId = metadataWarehouseId;
    warehouseIds = metadataWarehouseId ? [metadataWarehouseId] : [];
  } else if (roleUsesMultiWarehouseAssignment(role)) {
    warehouseIds =
      metadataWarehouseIds.length > 0
        ? metadataWarehouseIds
        : metadataWarehouseId
          ? [metadataWarehouseId]
          : [];
    warehouseId = warehouseIds[0] ?? null;
  } else if (role === Role.ADMIN) {
    warehouseIds =
      metadataWarehouseIds.length > 0
        ? metadataWarehouseIds
        : metadataWarehouseId
          ? [metadataWarehouseId]
          : [];
    warehouseId = warehouseIds[0] ?? metadataWarehouseId;
  }

  return {
    id: identity.id,
    email: identity.email,
    user_metadata: identity.userMetadata,
    app_metadata: identity.appMetadata,
    role,
    warehouseId,
    warehouseIds,
  };
}

/** One auth resolution per React request (RSC / Server Action / Route Handler). */
export const getRequestSession = cache(fetchRequestSession);

export function assertRole(
  user: SessionUser | null,
  allowedRoles: readonly AppRole[],
): SessionUser {
  if (!user) {
    redirect("/login");
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    redirect("/unauthorized");
  }
  return user;
}

export async function checkRole(allowedRoles: readonly AppRole[]): Promise<SessionUser> {
  return assertRole(await getRequestSession(), allowedRoles);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return getRequestSession();
}
