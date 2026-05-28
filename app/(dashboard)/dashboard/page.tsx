import { Suspense } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";

import { DashboardOverviewSection } from "@/components/dashboard/DashboardOverviewSection";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { POStageDistributionCard } from "@/components/dashboard/POStageDistribution";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { SkeletonMetrics } from "@/components/shared/SkeletonMetrics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCESS } from "@/lib/route-access";
import {
  getPOStageDistribution,
  getRecentActivity,
} from "@/lib/queries/dashboard-extras";
import { assertRole, getRequestSession } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";
import { timed } from "@/lib/server-timing";

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-ds-lg font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-ds-sm text-muted-foreground">
            Operational snapshot across procurement workflows.
          </p>
        </div>
        <Button variant="soft" size="sm" render={<Link href="/inbox" />}>
          <Inbox className="size-3.5" strokeWidth={1.5} aria-hidden />
          Open inbox
        </Button>
      </div>

      <Suspense
        fallback={
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <SkeletonMetrics count={4} />
          </>
        }
      >
        <DashboardOverviewSection user={user} displayName={displayName} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Suspense fallback={<Skeleton className="h-52 rounded-2xl" />}>
          <PODistributionSection scopeWarehouseIds={scopeWarehouseIds} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-52 rounded-2xl" />}>
          <ActivitySection scopeWarehouseIds={scopeWarehouseIds} />
        </Suspense>
      </div>

      <DashboardQuickActions role={user.role} />
    </div>
  );
}

async function PODistributionSection({
  scopeWarehouseIds,
}: {
  scopeWarehouseIds: string[];
}) {
  const stages = await timed("dashboard.poStages", () =>
    getPOStageDistribution(scopeWarehouseIds),
  );
  return <POStageDistributionCard stages={stages} />;
}

async function ActivitySection({
  scopeWarehouseIds,
}: {
  scopeWarehouseIds: string[];
}) {
  const items = await timed("dashboard.recentActivity", () =>
    getRecentActivity(scopeWarehouseIds, 8),
  );
  return <RecentActivityCard items={items} />;
}
