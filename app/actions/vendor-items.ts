"use server";

import { getVendorComparisonForCatalogItem } from "@/lib/queries/vendor-items";
import { requireRoles } from "@/lib/server-action-guard";
import { OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";

export async function fetchVendorComparisonForCatalogItem(catalogItemId: string) {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  return getVendorComparisonForCatalogItem(catalogItemId);
}
