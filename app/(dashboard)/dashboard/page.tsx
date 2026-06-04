import { Suspense } from "react";

import { DashboardOverviewSection } from "@/components/dashboard/DashboardOverviewSection";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { DashboardSecondarySection } from "@/components/dashboard/DashboardSecondarySection";
import { SkeletonMetrics } from "@/components/shared/SkeletonMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { Role } from "@/lib/prisma-enums";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.dashboard]);
  const displayName =
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    user.email ||
    "User";
  const scopeWarehouseIds = assignedWarehouseIds(user);

  return (
    <div className="page-stack">
      <DashboardPageHeader role={user.role} />

      <Suspense
        fallback={
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <SkeletonMetrics count={user.role === Role.FINANCE ? 6 : 4} />
          </>
        }
      >
        <DashboardOverviewSection user={user} displayName={displayName} />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        }
      >
        <DashboardSecondarySection user={user} scopeWarehouseIds={scopeWarehouseIds} />
      </Suspense>

      <DashboardQuickActions role={user.role} />
    </div>
  );
}
