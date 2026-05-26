"use client";

import { Role } from "@prisma/client";
import {
  Building2,
  FilePlus,
  Inbox,
  PackageCheck,
  Receipt,
  type LucideIcon,
} from "lucide-react";

import { ActionCard } from "@/components/shared/ActionCard";
import { AnimatedGrid, AnimatedGridItem } from "@/components/shared/AnimatedGrid";
import { PageSection } from "@/components/shared/PageSection";

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

const QUICK_ACTIONS_BY_ROLE: Record<Role, QuickAction[]> = {
  [Role.SM]: [
    {
      label: "Open inbox",
      href: "/inbox",
      icon: Inbox,
      description: "Drafts, revisions, and items waiting on you.",
    },
    {
      label: "Create PR",
      href: "/purchase-requests/new",
      icon: FilePlus,
      description: "Raise a vendor or internal-print purchase request.",
    },
    {
      label: "Record GRN",
      href: "/goods-receipt/new",
      icon: PackageCheck,
      description: "Log accepted, disputed, or damaged goods.",
    },
    {
      label: "Upload invoice",
      href: "/invoices/new",
      icon: Receipt,
      description: "Match a vendor invoice to a received PO.",
    },
  ],
  [Role.OPS_HEAD]: [
    {
      label: "Review approvals",
      href: "/purchase-requests?status=PENDING_APPROVAL",
      icon: Inbox,
      description: "Vendor PRs awaiting your decision.",
    },
    {
      label: "Vendors",
      href: "/vendors",
      icon: Building2,
      description: "Approve new vendor requests and govern records.",
    },
    {
      label: "Create PR",
      href: "/purchase-requests/new",
      icon: FilePlus,
      description: "Raise a request on behalf of a warehouse.",
    },
  ],
  [Role.FINANCE]: [
    {
      label: "Open inbox",
      href: "/inbox",
      icon: Inbox,
      description: "Invoices and payments awaiting action.",
    },
    {
      label: "Pay invoices",
      href: "/payments?paymentStatus=UNPAID",
      icon: Receipt,
      description: "Matched invoices ready for disbursement.",
    },
  ],
};

export function DashboardQuickActions({ role }: { role: Role }) {
  const actions = QUICK_ACTIONS_BY_ROLE[role];
  if (actions.length === 0) return null;

  return (
    <PageSection title="Quick actions" description="Jump into common workflows.">
      <AnimatedGrid className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <AnimatedGridItem key={action.href}>
            <ActionCard
              href={action.href}
              label={action.label}
              description={action.description}
              icon={action.icon}
              animated={false}
            />
          </AnimatedGridItem>
        ))}
      </AnimatedGrid>
    </PageSection>
  );
}
