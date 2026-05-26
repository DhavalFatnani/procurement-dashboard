"use client";

import {
  ClipboardList,
  FileText,
  Inbox,
  PackageCheck,
  UserPlus,
} from "lucide-react";

import { AnimatedGrid, AnimatedGridItem } from "@/components/shared/AnimatedGrid";
import { MetricSparkline } from "@/components/shared/MetricSparkline";
import { MetricTile } from "@/components/shared/MetricTile";
import type { DashboardMetrics } from "@/lib/queries/dashboard";

export function DashboardMetricsGrid({
  metrics,
  variant,
  sparklineData = [],
}: {
  metrics: DashboardMetrics;
  variant: "ops" | "default";
  sparklineData?: { value: number }[];
}) {
  const sparkline =
    sparklineData.length > 0 ? (
      <MetricSparkline data={sparklineData} />
    ) : undefined;

  if (variant === "ops") {
    return (
      <AnimatedGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatedGridItem>
          <MetricTile
            label="Pending approvals"
            value={metrics.pendingApprovals}
            hint="Vendor PRs awaiting Ops Head"
            icon={ClipboardList}
            iconTone="warning"
            href="/purchase-requests?status=PENDING_APPROVAL"
            sparkline={sparkline}
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Open purchase orders"
            value={metrics.openPurchaseOrders}
            hint="Not yet closed or fully paid"
            icon={PackageCheck}
            iconTone="info"
            href="/purchase-orders?status=OPEN"
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Pending vendor requests"
            value={metrics.pendingVendorRequests}
            hint="Awaiting activation"
            icon={UserPlus}
            iconTone="accent"
            href="/vendors?tab=pending"
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Draft requests"
            value={metrics.draftPurchaseRequests}
            hint="All warehouses"
            icon={FileText}
            iconTone="neutral"
            href="/purchase-requests?status=DRAFT"
          />
        </AnimatedGridItem>
      </AnimatedGrid>
    );
  }

  return (
    <AnimatedGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatedGridItem>
        <MetricTile
          label="Draft requests"
          value={metrics.draftPurchaseRequests}
          hint="Your warehouse"
          icon={FileText}
          iconTone="neutral"
          href="/purchase-requests?status=DRAFT"
          sparkline={sparkline}
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="Pending approvals"
          value={metrics.pendingApprovals}
          hint="Submitted for Ops Head review"
          icon={Inbox}
          iconTone="warning"
          href="/purchase-requests?status=PENDING_APPROVAL"
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="Open purchase orders"
          value={metrics.openPurchaseOrders}
          hint="Not yet closed or fully paid"
          icon={PackageCheck}
          iconTone="info"
          href="/purchase-orders"
        />
      </AnimatedGridItem>
    </AnimatedGrid>
  );
}
