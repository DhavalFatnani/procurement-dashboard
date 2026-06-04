"use server";

import { Role } from "@/lib/prisma-enums";
import { getVendorComparisonForCatalogItem } from "@/lib/queries/vendor-items";
import { requireRoles } from "@/lib/server-action-guard";

export async function fetchVendorComparisonForCatalogItem(catalogItemId: string) {
  await requireRoles([Role.OPS_HEAD]);
  return getVendorComparisonForCatalogItem(catalogItemId);
}
