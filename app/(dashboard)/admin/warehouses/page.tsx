import { Role } from "@/lib/prisma-enums";

import { WarehousesView } from "@/components/admin/WarehousesView";
import { getWarehouses } from "@/lib/queries/warehouses";
import { assertRole, getRequestSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminWarehousesPage() {
  assertRole(await getRequestSession(), [Role.OPS_HEAD]);
  const rows = await getWarehouses();
  return <WarehousesView rows={rows} />;
}
