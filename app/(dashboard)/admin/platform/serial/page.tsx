import { SerialAdminConsole } from "@/components/admin/SerialAdminConsole";
import { getCachedSeriesRegistry, getCachedWarehouses } from "@/lib/cache";
import { getSerialRepairQueue } from "@/lib/serial-admin";
import { buildSeriesOptions } from "@/lib/series-registry";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminSerialPlatformPage() {
  assertRole(await getRequestSession(), [...ACCESS.adminPlatform]);

  const [repairQueue, warehouses, registry] = await Promise.all([
    getSerialRepairQueue(50),
    getCachedWarehouses(),
    getCachedSeriesRegistry(),
  ]);

  return (
    <SerialAdminConsole
      repairQueue={repairQueue}
      seriesOptions={buildSeriesOptions(registry)}
      warehouses={warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        location: w.location,
      }))}
    />
  );
}
