import { Suspense } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";

import { DashboardMetricsSection } from "@/components/dashboard/DashboardMetricsSection";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { DashboardWelcomeStrip } from "@/components/dashboard/DashboardWelcomeStrip";
import { POStageDistributionCard } from "@/components/dashboard/POStageDistribution";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { SkeletonMetrics } from "@/components/shared/SkeletonMetrics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCESS } from "@/lib/route-access";
import { getDashboardMetricsForSession } from "@/lib/queries/dashboard";
import {
  getPOStageDistribution,
  getRecentActivity,
} from "@/lib/queries/dashboard-extras";
import { assertRole, getRequestSession } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const user = assertRole(await getRequestSession(), [...ACCESS.dashboard]);
  const metrics = await getDashboardMetricsForSession(user);
  const displayName =
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    user.email ||
    "User";

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

      <DashboardWelcomeStrip
        displayName={displayName}
        role={user.role}
        metrics={metrics}
      />

      <Suspense fallback={<SkeletonMetrics count={4} />}>
        <DashboardMetricsSection user={user} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Suspense fallback={<Skeleton className="h-52 rounded-2xl" />}>
          <PODistributionSection />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-52 rounded-2xl" />}>
          <ActivitySection />
        </Suspense>
      </div>

      <DashboardQuickActions role={user.role} />
    </div>
  );
}

async function PODistributionSection() {
  const user = assertRole(await getRequestSession(), [...ACCESS.dashboard]);
  const scopeWarehouseIds = assignedWarehouseIds(user);
  const stages = await getPOStageDistribution(scopeWarehouseIds);
  return <POStageDistributionCard stages={stages} />;
}

async function ActivitySection() {
  const user = assertRole(await getRequestSession(), [...ACCESS.dashboard]);
  const scopeWarehouseIds = assignedWarehouseIds(user);
  const items = await getRecentActivity(scopeWarehouseIds, 8);
  return <RecentActivityCard items={items} />;
}
