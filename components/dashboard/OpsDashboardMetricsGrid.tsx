"use client";

import {
  AlertTriangle,
  CheckSquare,
  ClipboardList,
  PackageCheck,
  UserPlus,
} from "lucide-react";

import { AnimatedGrid, AnimatedGridItem } from "@/components/shared/AnimatedGrid";
import { MetricTile } from "@/components/shared/MetricTile";
import type { OpsDashboardMetrics } from "@/lib/queries/dashboard";

export function OpsDashboardMetricsGrid({ metrics }: { metrics: OpsDashboardMetrics }) {
  return (
    <AnimatedGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <AnimatedGridItem>
        <MetricTile
          label="Pending approvals"
          value={metrics.pendingApprovals}
          hint="Vendor PRs in your queue"
          icon={ClipboardList}
          iconTone={metrics.pendingApprovals > 0 ? "warning" : "neutral"}
          href="/purchase-requests?status=PENDING_APPROVAL"
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="Awaiting PO setup"
          value={metrics.prsAwaitingPo}
          hint="Approved PRs without a PO"
          icon={ClipboardList}
          iconTone={metrics.prsAwaitingPo > 0 ? "accent" : "neutral"}
          href="/purchase-orders/configure"
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="Pending vendors"
          value={metrics.pendingVendorRequests}
          hint="Activation requests"
          icon={UserPlus}
          iconTone={metrics.pendingVendorRequests > 0 ? "accent" : "neutral"}
          href="/vendors?tab=pending"
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="GRN exceptions"
          value={metrics.openGrnExceptions}
          hint="Unresolved receipt disputes"
          icon={AlertTriangle}
          iconTone={metrics.openGrnExceptions > 0 ? "error" : "success"}
          href="/inbox"
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="Match exceptions"
          value={metrics.matchExceptions}
          hint="Invoices blocked without override"
          icon={CheckSquare}
          iconTone={metrics.matchExceptions > 0 ? "error" : "success"}
          href="/inbox"
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="Open purchase orders"
          value={metrics.openPurchaseOrders}
          hint="In flight across warehouses"
          icon={PackageCheck}
          iconTone="info"
          href="/purchase-orders"
        />
      </AnimatedGridItem>
    </AnimatedGrid>
  );
}
