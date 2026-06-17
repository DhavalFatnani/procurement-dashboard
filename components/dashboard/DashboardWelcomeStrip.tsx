import Link from "next/link";
import { Role } from "@/lib/prisma-enums";

import { SurfaceCard } from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import type {
  DashboardMetrics,
  FinanceDashboardMetrics,
  OpsDashboardMetrics,
} from "@/lib/queries/dashboard";
import { ROLE_LABELS } from "@/lib/navigation";

const PENDING_LINKS: Partial<Record<Role, { href: string; label: string }>> = {
  [Role.CENTRAL_TEAM]: {
    href: "/purchase-orders/configure",
    label: "Configure purchase orders",
  },
  [Role.OPS_HEAD]: {
    href: "/purchase-requests?status=PENDING_APPROVAL",
    label: "Review pending approvals",
  },
  [Role.ADMIN]: {
    href: "/admin/platform",
    label: "Open platform control",
  },
  [Role.SM]: {
    href: "/inbox",
    label: "Open inbox",
  },
  [Role.FINANCE]: {
    href: `${FINANCE_ROUTES.invoiceSettlement}?paymentStatus=UNPAID`,
    label: "Open unpaid invoices",
  },
};

function isFinanceMetrics(
  metrics: DashboardMetrics | FinanceDashboardMetrics | OpsDashboardMetrics,
): metrics is FinanceDashboardMetrics {
  return "paymentAgeing" in metrics;
}

function isOpsMetrics(
  metrics: DashboardMetrics | FinanceDashboardMetrics | OpsDashboardMetrics,
): metrics is OpsDashboardMetrics {
  return "openGrnExceptions" in metrics;
}

function attentionCount(
  role: Role,
  metrics: DashboardMetrics | FinanceDashboardMetrics | OpsDashboardMetrics,
): number {
  if (isFinanceMetrics(metrics)) {
    return metrics.unpaidInvoices.count;
  }
  if (isOpsMetrics(metrics)) {
    const approvalCount = role === Role.CENTRAL_TEAM ? 0 : metrics.pendingApprovals;
    return (
      approvalCount +
      metrics.pendingVendorRequests +
      metrics.prsAwaitingPo +
      metrics.openGrnExceptions +
      metrics.matchExceptions
    );
  }
  const sm = metrics as DashboardMetrics;
  return sm.draftPurchaseRequests + sm.pendingApprovals + sm.posAwaitingReceipt;
}

export function DashboardWelcomeStrip({
  displayName,
  role,
  metrics,
}: {
  displayName: string;
  role: Role;
  metrics: DashboardMetrics | FinanceDashboardMetrics | OpsDashboardMetrics;
}) {
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const pendingCount = attentionCount(role, metrics);
  const pendingLink = PENDING_LINKS[role];

  const attentionHint =
    role === Role.SM && !isFinanceMetrics(metrics) && !isOpsMetrics(metrics)
      ? `${metrics.draftPurchaseRequests} draft · ${metrics.pendingApprovals} pending · ${metrics.posAwaitingReceipt} to receive`
      : role === Role.CENTRAL_TEAM && isOpsMetrics(metrics)
        ? `${metrics.prsAwaitingPo} configure PO · ${metrics.pendingVendorRequests} vendors · ${metrics.openGrnExceptions + metrics.matchExceptions} to review`
        : role === Role.OPS_HEAD && isOpsMetrics(metrics)
        ? `${metrics.pendingApprovals} approvals · ${metrics.prsAwaitingPo} configure PO · ${metrics.openGrnExceptions + metrics.matchExceptions} exceptions`
        : role === Role.ADMIN && isOpsMetrics(metrics)
          ? `${metrics.pendingApprovals} approvals · ${metrics.prsAwaitingPo} configure PO · ${metrics.openGrnExceptions + metrics.matchExceptions} exceptions (all warehouses)`
          : null;

  return (
    <SurfaceCard variant="accent" size="lg" className="surface-glow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
            {ROLE_LABELS[role]}
          </p>
          <h1 className="text-ds-lg font-semibold tracking-tight text-foreground">
            Good to see you, {firstName}
          </h1>
          <p className="text-ds-sm text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} need${pendingCount === 1 ? "s" : ""} attention across your scope.`
              : role === Role.FINANCE
                ? "You're all caught up on payables."
                : role === Role.OPS_HEAD
                  ? "You're all caught up on governance and exceptions."
                  : "You're all caught up on pending work."}
          </p>
          {pendingCount > 0 && attentionHint ? (
            <p className="text-ds-xs text-muted-foreground">{attentionHint}</p>
          ) : null}
        </div>
        {pendingLink && pendingCount > 0 ? (
          <Button variant="gradient" size="sm" render={<Link href={pendingLink.href} />}>
            {pendingLink.label}
          </Button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
