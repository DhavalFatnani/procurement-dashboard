"use server";

import { Role } from "@prisma/client";

import { findEntities } from "@/lib/queries/finder";
import { requireRoles } from "@/lib/server-action-guard";

export async function searchEntities(
  query: string,
): Promise<Awaited<ReturnType<typeof findEntities>>> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD, Role.FINANCE]);
  return findEntities({ query, role: user.role });
}
