import { Role } from "@/lib/prisma-enums";

import { DashboardMetricsGrid } from "@/components/dashboard/DashboardMetricsGrid";
import { DashboardWelcomeStrip } from "@/components/dashboard/DashboardWelcomeStrip";
import { OpsDashboardMetricsGrid } from "@/components/dashboard/OpsDashboardMetricsGrid";
import { dbParallel } from "@/lib/db-parallel";
import {
  getDashboardMetricsForSession,
  getFinanceDashboardMetrics,
  getOpsDashboardMetrics,
} from "@/lib/queries/dashboard";
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
  if (user.role === Role.FINANCE) {
    const metrics = await timed("dashboard.financeMetrics", () =>
      getFinanceDashboardMetrics(user),
    );

    return (
      <>
        <DashboardWelcomeStrip
          displayName={displayName}
          role={user.role}
          metrics={metrics}
        />
        <DashboardMetricsGrid metrics={metrics} variant="finance" />
      </>
    );
  }

  if (user.role === Role.OPS_HEAD || user.role === Role.ADMIN) {
    const metrics = await timed("dashboard.opsMetrics", () =>
      getOpsDashboardMetrics(user),
    );

    return (
      <>
        <DashboardWelcomeStrip
          displayName={displayName}
          role={user.role}
          metrics={metrics}
        />
        <OpsDashboardMetricsGrid metrics={metrics} />
      </>
    );
  }

  const [metrics, sparkline] = await dbParallel(
    () => timed("dashboard.metrics", () => getDashboardMetricsForSession(user)),
    () =>
      timed("dashboard.sparkline", () =>
        getPrCreationSparkline({ warehouseIds: assignedWarehouseIds(user) }),
      ),
  );

  return (
    <>
      <DashboardWelcomeStrip
        displayName={displayName}
        role={user.role}
        metrics={metrics}
      />
      <DashboardMetricsGrid
        metrics={metrics}
        variant="default"
        sparklineData={sparkline.map((d) => ({ value: d.count }))}
      />
    </>
  );
}
