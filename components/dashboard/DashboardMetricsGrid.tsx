"use client";

import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  FileText,
  HandCoins,
  Inbox,
  PackageCheck,
  Receipt,
  UserPlus,
  Wallet,
} from "lucide-react";

import { AnimatedGrid, AnimatedGridItem } from "@/components/shared/AnimatedGrid";
import { MetricSparkline } from "@/components/shared/MetricSparkline";
import { MetricTile } from "@/components/shared/MetricTile";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { formatInr } from "@/lib/format-datetime";
import type { DashboardMetrics, FinanceDashboardMetrics } from "@/lib/queries/dashboard";

export function DashboardMetricsGrid({
  metrics,
  variant,
  sparklineData = [],
}: {
  metrics: DashboardMetrics | FinanceDashboardMetrics;
  variant: "ops" | "default" | "finance";
  sparklineData?: { value: number }[];
}) {
  const sparkline =
    sparklineData.some((d) => d.value > 0) ? (
      <MetricSparkline data={sparklineData} />
    ) : undefined;

  if (variant === "finance") {
    const finance = metrics as FinanceDashboardMetrics;
    const ageingTotal = finance.paymentAgeing.reduce((sum, b) => sum + b.count, 0);
    const paidTotal =
      finance.paidThisMonth.cash + finance.paidThisMonth.allocations;

    return (
      <AnimatedGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <AnimatedGridItem>
          <MetricTile
            label="Unpaid invoices"
            value={finance.unpaidInvoices.count}
            hint={formatInr(finance.unpaidInvoices.value)}
            icon={Receipt}
            iconTone={finance.unpaidInvoices.count > 5 ? "error" : "warning"}
            href={`${FINANCE_ROUTES.invoiceSettlement}?paymentStatus=UNPAID`}
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Pending advances"
            value={finance.pendingVendorAdvances}
            hint="Awaiting Finance payment"
            icon={HandCoins}
            iconTone={finance.pendingVendorAdvances > 0 ? "warning" : "neutral"}
            href={FINANCE_ROUTES.vendorAdvances}
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Paid this month"
            value={formatInr(paidTotal)}
            hint={`${formatInr(finance.paidThisMonth.cash)} cash · ${formatInr(finance.paidThisMonth.allocations)} advance`}
            icon={Wallet}
            iconTone="success"
            href={FINANCE_ROUTES.paymentRegister}
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Match exceptions"
            value={finance.matchExceptions}
            hint="Invoices with mismatch"
            icon={CheckSquare}
            iconTone={finance.matchExceptions > 0 ? "error" : "success"}
            href={`${FINANCE_ROUTES.invoiceSettlement}?matchStatus=MISMATCH`}
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Advance over commitment"
            value={finance.advanceOverCommitment}
            hint="POs over-committed on advance"
            icon={AlertTriangle}
            iconTone={finance.advanceOverCommitment > 0 ? "warning" : "success"}
            href="/reports?section=ageing"
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Payment ageing"
            value={ageingTotal}
            hint={finance.paymentAgeing.map((b) => `${b.bucket}: ${b.count}`).join(" · ")}
            icon={CalendarClock}
            iconTone={
              finance.paymentAgeing.some((b) => b.bucket === "30d+" && b.count > 0)
                ? "error"
                : "info"
            }
            href="/reports?section=ageing"
          />
        </AnimatedGridItem>
      </AnimatedGrid>
    );
  }

  const opsMetrics = metrics as DashboardMetrics;

  if (variant === "ops") {
    return (
      <AnimatedGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatedGridItem>
          <MetricTile
            label="Pending approvals"
            value={opsMetrics.pendingApprovals}
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
            value={opsMetrics.openPurchaseOrders}
            hint="Not yet closed or fully paid"
            icon={PackageCheck}
            iconTone="info"
            href="/purchase-orders?status=OPEN"
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Pending vendor requests"
            value={opsMetrics.pendingVendorRequests}
            hint="Awaiting activation"
            icon={UserPlus}
            iconTone="accent"
            href="/vendors?tab=pending"
          />
        </AnimatedGridItem>
        <AnimatedGridItem>
          <MetricTile
            label="Awaiting receipt"
            value={opsMetrics.posAwaitingReceipt}
            hint="POs needing goods receipt"
            icon={PackageCheck}
            iconTone="warning"
            href="/goods-receipt"
          />
        </AnimatedGridItem>
      </AnimatedGrid>
    );
  }

  return (
    <AnimatedGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <AnimatedGridItem>
        <MetricTile
          label="Draft requests"
          value={opsMetrics.draftPurchaseRequests}
          hint="Finish and submit for approval"
          icon={FileText}
          iconTone="neutral"
          href="/purchase-requests?status=DRAFT"
          sparkline={sparkline}
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="Pending approval"
          value={opsMetrics.pendingApprovals}
          hint="Submitted for Ops Head review"
          icon={Inbox}
          iconTone="warning"
          href="/purchase-requests?status=PENDING_APPROVAL"
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="POs to receive"
          value={opsMetrics.posAwaitingReceipt}
          hint="Record goods receipt"
          icon={PackageCheck}
          iconTone="info"
          href="/goods-receipt/new"
        />
      </AnimatedGridItem>
      <AnimatedGridItem>
        <MetricTile
          label="Open purchase orders"
          value={opsMetrics.openPurchaseOrders}
          hint="In progress across your warehouses"
          icon={ClipboardList}
          iconTone="neutral"
          href="/purchase-orders"
        />
      </AnimatedGridItem>
    </AnimatedGrid>
  );
}
