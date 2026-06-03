import { Role } from "@/lib/prisma-enums";

import { DashboardMetricsGrid } from "@/components/dashboard/DashboardMetricsGrid";
import { DashboardWelcomeStrip } from "@/components/dashboard/DashboardWelcomeStrip";
import { dbParallel } from "@/lib/db-parallel";
import { getDashboardMetricsForSession } from "@/lib/queries/dashboard";
import { getPrCreationSparkline } from "@/lib/queries/dashboard-extras";
import type { SessionUser } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";
import { timed } from "@/lib/server-timing";

export async function DashboardOverviewSection({
  user,
  displayName,
}: {
  user: SessionUser;
  displayName: string;
}) {
  const [metrics, sparkline] = await dbParallel(
    () => timed("dashboard.metrics", () => getDashboardMetricsForSession(user)),
    () =>
      timed("dashboard.sparkline", () =>
        getPrCreationSparkline({ warehouseIds: assignedWarehouseIds(user) }),
      ),
  );

  const isOps = user.role === Role.OPS_HEAD;

  return (
    <>
      <DashboardWelcomeStrip
        displayName={displayName}
        role={user.role}
        metrics={metrics}
      />
      <DashboardMetricsGrid
        metrics={metrics}
        variant={isOps ? "ops" : "default"}
        sparklineData={sparkline.map((d) => ({ value: d.count }))}
      />
    </>
  );
}
