import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { SurfaceCard, SurfaceCardDescription, SurfaceCardTitle } from "@/components/shared/SurfaceCard";
import { buttonVariants } from "@/components/ui/button";
import type { AdminAuditLogRow } from "@/lib/admin-audit";
import { cn } from "@/lib/utils";

const QUICK_LINKS = [
  {
    href: "/admin/platform/series",
    title: "Series config",
    description: "Rename series labels, prefix patterns, ceilings, and alert thresholds.",
  },
  {
    href: "/admin/platform/serial",
    title: "Serial control",
    description: "Block, release, split, and reassign serial ranges. Review orphaned reservations.",
  },
  {
    href: "/serial-governance/range-map?admin=1",
    title: "Range map (admin)",
    description: "Visual ledger with admin actions on selected segments.",
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Create and manage roles, including other Admin accounts.",
  },
  {
    href: "/admin/warehouses",
    title: "Warehouses",
    description: "Master data for warehouse locations and assignments.",
  },
  {
    href: "/admin/taxonomy",
    title: "Item catalog",
    description: "Approve and maintain catalog items used on purchase lines.",
  },
  {
    href: "/payments/invoices",
    title: "Invoice settlement",
    description: "Global payables — settle invoices and apply advance credit.",
  },
] as const;

function formatAction(action: string): string {
  return action.replaceAll("_", " ").toLowerCase();
}

export function PlatformControlView({
  auditLogs,
  repairCount,
}: {
  auditLogs: AdminAuditLogRow[];
  repairCount: number;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/users" },
          { label: "Platform control" },
        ]}
        title="Platform control"
        subtitle="Global administration for procurement, payables, master data, and serial governance overrides."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SurfaceCard className="md:col-span-1">
          <SurfaceCardTitle>Scope</SurfaceCardTitle>
          <SurfaceCardDescription className="mt-2">
            All warehouses. Full write access to procurement, payables, master data, and audited serial
            overrides.
          </SurfaceCardDescription>
        </SurfaceCard>
        <SurfaceCard className="md:col-span-1">
          <SurfaceCardTitle>Repair queue</SurfaceCardTitle>
          <SurfaceCardDescription className="mt-2">
            {repairCount === 0
              ? "No orphaned or admin-blocked reservations need attention."
              : `${repairCount} active reservation${repairCount === 1 ? "" : "s"} flagged for review.`}
          </SurfaceCardDescription>
          {repairCount > 0 ? (
            <Link
              href="/admin/platform/serial"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 inline-flex")}
            >
              Open serial control
            </Link>
          ) : null}
        </SurfaceCard>
        <SurfaceCard className="md:col-span-1">
          <SurfaceCardTitle>Audit trail</SurfaceCardTitle>
          <SurfaceCardDescription className="mt-2">
            Every admin serial override is logged with actor, reason, and target metadata.
          </SurfaceCardDescription>
        </SurfaceCard>
      </div>

      <SurfaceCard
        header={
          <>
            <SurfaceCardTitle>Quick links</SurfaceCardTitle>
            <SurfaceCardDescription>Jump to common admin workflows.</SurfaceCardDescription>
          </>
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block rounded-md border border-border-subtle px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
              >
                <p className="text-ds-sm font-medium text-foreground">{link.title}</p>
                <p className="mt-1 text-ds-xs text-muted-foreground">{link.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </SurfaceCard>

      <SurfaceCard
        header={
          <>
            <SurfaceCardTitle>Recent admin actions</SurfaceCardTitle>
            <SurfaceCardDescription>Latest audited platform overrides.</SurfaceCardDescription>
          </>
        }
      >
        {auditLogs.length === 0 ? (
          <p className="text-ds-sm text-muted-foreground">No admin audit entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-ds-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-ds-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">When</th>
                  <th className="pb-2 pr-4 font-medium">Actor</th>
                  <th className="pb-2 pr-4 font-medium">Action</th>
                  <th className="pb-2 pr-4 font-medium">Target</th>
                  <th className="pb-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((row) => (
                  <tr key={row.id} className="border-b border-border-subtle/60">
                    <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 pr-4">{row.actorName}</td>
                    <td className="py-2 pr-4 capitalize">{formatAction(row.action)}</td>
                    <td className="py-2 pr-4 font-mono text-ds-xs">
                      {row.targetType}
                      {row.targetId ? ` · ${row.targetId.slice(0, 8)}…` : ""}
                    </td>
                    <td className="py-2">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
