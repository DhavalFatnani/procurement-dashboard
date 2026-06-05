import { SeriesConfigAdminConsole } from "@/components/admin/SeriesConfigAdminConsole";
import { getSeriesConfigAdminRows } from "@/lib/queries/series-config-admin";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminSeriesConfigPage() {
  assertRole(await getRequestSession(), [...ACCESS.adminPlatform]);

  const rows = await getSeriesConfigAdminRows();

  return <SeriesConfigAdminConsole rows={rows} />;
}
