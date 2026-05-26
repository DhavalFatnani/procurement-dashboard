import Link from "next/link";
import { Role } from "@prisma/client";

import { SurfaceCard } from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import type { DashboardMetrics } from "@/lib/queries/dashboard";
import { ROLE_LABELS } from "@/lib/navigation";

const PENDING_LINKS: Partial<Record<Role, { href: string; label: string }>> = {
  [Role.OPS_HEAD]: {
    href: "/purchase-requests?status=PENDING_APPROVAL",
    label: "Review pending approvals",
  },
  [Role.SM]: {
    href: "/purchase-requests?status=PENDING_APPROVAL",
    label: "View submitted requests",
  },
  [Role.FINANCE]: {
    href: "/payments?paymentStatus=UNPAID",
    label: "Open unpaid invoices",
  },
};

export function DashboardWelcomeStrip({
  displayName,
  role,
  metrics,
}: {
  displayName: string;
  role: Role;
  metrics: DashboardMetrics;
}) {
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const pendingCount =
    role === Role.FINANCE
      ? metrics.openPurchaseOrders
      : metrics.pendingApprovals;
  const pendingLink = PENDING_LINKS[role];

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
              ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} need${pendingCount === 1 ? "s" : ""} attention today.`
              : "You're all caught up on pending work."}
          </p>
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
