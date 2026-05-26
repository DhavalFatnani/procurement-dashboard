"use server";

import { Role } from "@prisma/client";

import { findEntities } from "@/lib/queries/finder";
import { requireRoles } from "@/lib/server-action-guard";

// Re-export the type directly from its source module. The previous form —
// `import { type FinderResult }` followed by `export type { FinderResult }` —
// is mishandled by Turbopack: it doesn't elide the type-only specifier and
// emits a runtime reference to an undefined identifier.
export type { FinderResult } from "@/lib/queries/finder";

export async function searchEntities(
  query: string,
): Promise<Awaited<ReturnType<typeof findEntities>>> {
  const user = await requireRoles([Role.SM, Role.OPS_HEAD, Role.FINANCE]);
  return findEntities({ query, role: user.role });
}
