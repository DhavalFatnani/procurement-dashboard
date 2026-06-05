import { Role } from "@/lib/prisma-enums";

import { DashboardPrTrendCard } from "@/components/dashboard/DashboardPrTrendCard";
import { DashboardWorkQueueCard } from "@/components/dashboard/DashboardWorkQueueCard";
import { PaymentAgeingSummaryCard } from "@/components/dashboard/PaymentAgeingSummaryCard";
import { POStageDistributionCard } from "@/components/dashboard/POStageDistribution";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { dbParallel } from "@/lib/db-parallel";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { getFinanceDashboardMetrics } from "@/lib/queries/dashboard";
import {
  getDashboardWorkQueue,
  getPOStageDistribution,
  getPrCreationSparkline,
  getRecentActivityForRole,
} from "@/lib/queries/dashboard-extras";
import type { SessionUser } from "@/lib/session";
import { assignedWarehouseIds } from "@/lib/warehouse-scope";
import { timed } from "@/lib/server-timing";

export async function DashboardSecondarySection({
  user,
  scopeWarehouseIds,
}: {
  user: SessionUser;
  scopeWarehouseIds: string[] | undefined;
}) {
  if (user.role === Role.FINANCE) {
    const [financeMetrics, queue, activity] = await dbParallel(
      () =>
        timed("dashboard.financeAgeing", () => getFinanceDashboardMetrics(user)),
      () =>
        timed("dashboard.financeQueue", () =>
          getDashboardWorkQueue(Role.FINANCE, scopeWarehouseIds),
        ),
      () =>
        timed("dashboard.financeActivity", () =>
          getRecentActivityForRole(Role.FINANCE, 8, scopeWarehouseIds),
        ),
    );

    return (
      <div className="grid items-stretch gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <PaymentAgeingSummaryCard buckets={financeMetrics.paymentAgeing} />
          <DashboardWorkQueueCard
            title="Needs settlement"
            description="Oldest unpaid invoices — open to settle or apply advance credit."
            items={queue}
            viewAllHref={`${FINANCE_ROUTES.invoiceSettlement}?paymentStatus=UNPAID`}
            viewAllLabel="Settlement queue"
          />
        </div>
        <RecentActivityCard
          title="Recent settlements"
          emptyTitle="No settlements yet"
          emptyDescription="Cash payments and advance credits will appear here."
          items={activity}
        />
      </div>
    );
  }

  if (user.role === Role.OPS_HEAD || user.role === Role.ADMIN) {
    const [stages, queue, activity] = await dbParallel(
      () =>
        timed("dashboard.poStages", () =>
          getPOStageDistribution(scopeWarehouseIds),
        ),
      () =>
        timed("dashboard.opsQueue", () =>
          getDashboardWorkQueue(user.role, scopeWarehouseIds),
        ),
      () =>
        timed("dashboard.opsActivity", () =>
          getRecentActivityForRole(user.role, 8, scopeWarehouseIds),
        ),
    );

    return (
      <div className="grid items-stretch gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <POStageDistributionCard
            stages={stages}
            variant="compact"
            subtitle="Org-wide PO pipeline — spot bottlenecks before they block Finance."
          />
          <DashboardWorkQueueCard
            title="Governance queue"
            description="Approvals, vendor onboarding, PO configuration, and exceptions blocking downstream teams."
            items={queue}
            viewAllHref={
              user.role === Role.ADMIN
                ? "/purchase-requests?status=PENDING_APPROVAL"
                : "/inbox"
            }
            viewAllLabel={user.role === Role.ADMIN ? "Review approvals" : "Open inbox"}
          />
        </div>
        <RecentActivityCard
          title="Org-wide activity"
          emptyTitle="No activity yet"
          emptyDescription="Cross-team PR, GRN, invoice, and payment events appear here."
          items={activity}
        />
      </div>
    );
  }

  const warehouseIds = assignedWarehouseIds(user);
  const [stages, queue, sparkline, activity] = await dbParallel(
    () =>
      timed("dashboard.poStages", () => getPOStageDistribution(scopeWarehouseIds)),
    () =>
      timed("dashboard.smQueue", () => getDashboardWorkQueue(Role.SM, scopeWarehouseIds)),
    () =>
      timed("dashboard.smSparkline", () =>
        getPrCreationSparkline({ warehouseIds }),
      ),
    () =>
      timed("dashboard.smActivity", () =>
        getRecentActivityForRole(Role.SM, 8, scopeWarehouseIds),
      ),
  );

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col gap-4">
        <POStageDistributionCard
          stages={stages}
          variant="compact"
          subtitle="POs in your assigned warehouses — tap a stage to filter the list."
        />
        <DashboardWorkQueueCard
          title="Your next steps"
          description="Drafts to finish, submissions in review, and POs ready for receipt."
          items={queue}
          viewAllHref="/inbox"
        />
        <DashboardPrTrendCard data={sparkline} />
      </div>
      <RecentActivityCard
        title="Your recent work"
        emptyTitle="Nothing recent yet"
        emptyDescription="PR updates, goods receipts, and invoice uploads appear here."
        items={activity}
      />
    </div>
  );
}
