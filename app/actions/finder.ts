"use server";

import { ALL_DASHBOARD_ROLES } from "@/lib/admin-access";
import { findEntities } from "@/lib/queries/finder";
import { requireRoles } from "@/lib/server-action-guard";

export async function searchEntities(
  query: string,
): Promise<Awaited<ReturnType<typeof findEntities>>> {
  const user = await requireRoles([...ALL_DASHBOARD_ROLES]);
  return findEntities({ query, role: user.role });
}
