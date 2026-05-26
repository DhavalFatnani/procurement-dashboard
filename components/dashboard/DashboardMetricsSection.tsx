import { Role } from "@prisma/client";

import { DashboardMetricsGrid } from "@/components/dashboard/DashboardMetricsGrid";
import { dbParallel } from "@/lib/db-parallel";
import { getDashboardMetricsForSession } from "@/lib/queries/dashboard";
import { getPrCreationSparkline } from "@/lib/queries/dashboard-extras";
import type { SessionUser } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

export async function DashboardMetricsSection({ user }: { user: SessionUser }) {
  const [metrics, sparkline] = await dbParallel(
    () => getDashboardMetricsForSession(user),
    () => getPrCreationSparkline({ warehouseIds: assignedWarehouseIds(user) }),
  );

  const isOps = user.role === Role.OPS_HEAD;
  return (
    <DashboardMetricsGrid
      metrics={metrics}
      variant={isOps ? "ops" : "default"}
      sparklineData={sparkline.map((d) => ({ value: d.count }))}
    />
  );
}
