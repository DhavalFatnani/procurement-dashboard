"use server";

import { Role } from "@/lib/prisma-enums";
import { getVendorComparisonForCatalogItem } from "@/lib/queries/vendor-items";
import { requireRoles } from "@/lib/server-action-guard";
import { ALL_DASHBOARD_ROLES, FINANCE_OR_ADMIN_ROLES, OPS_FINANCE_OR_ADMIN_ROLES, OPS_OR_ADMIN_ROLES, SM_OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";

export async function fetchVendorComparisonForCatalogItem(catalogItemId: string) {
  await requireRoles([...OPS_OR_ADMIN_ROLES]);
  return getVendorComparisonForCatalogItem(catalogItemId);
}
