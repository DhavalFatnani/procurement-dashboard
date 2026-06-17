import { WarehousesView } from "@/components/admin/WarehousesView";
import { getWarehouses } from "@/lib/queries/warehouses";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminWarehousesPage() {
  assertRole(await getRequestSession(), [...ACCESS.admin]);
  const rows = await getWarehouses();
  return <WarehousesView rows={rows} />;
}
