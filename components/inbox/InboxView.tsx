"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  FilePlus,
  FileText,
  Inbox,
  PackageCheck,
  Receipt,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import type { InboxData, InboxItem, InboxItemKind } from "@/lib/queries/inbox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProcurementRefText } from "@/components/shared/ProcurementRef";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  InboxItemKind,
  { icon: LucideIcon; tone: "info" | "warning" | "success" | "neutral" | "error" }
> = {
  pr_draft: { icon: FileText, tone: "neutral" },
  pr_revision_required: { icon: AlertTriangle, tone: "warning" },
  pr_pending_approval: { icon: ClipboardList, tone: "info" },
  po_to_receive: { icon: PackageCheck, tone: "info" },
  grn_exception: { icon: AlertTriangle, tone: "warning" },
  invoice_to_upload: { icon: Receipt, tone: "info" },
  invoice_to_pay: { icon: Receipt, tone: "info" },
  invoice_partial: { icon: Receipt, tone: "warning" },
  vendor_request: { icon: UserPlus, tone: "info" },
  po_at_risk: { icon: AlertTriangle, tone: "error" },
};

const TONE_STYLES: Record<"info" | "warning" | "success" | "neutral" | "error", string> = {
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]",
  error: "bg-[var(--status-error-bg)] text-[var(--status-error)]",
};

function InboxIcon({ kind }: { kind: InboxItemKind }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md",
        TONE_STYLES[meta.tone],
      )}
      aria-hidden
    >
      <Icon className="size-4" strokeWidth={1.5} />
    </span>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  return (
    <li className="group flex items-center gap-3 rounded-lg border border-border-subtle bg-card px-3 py-2.5 transition-all duration-fast hover:border-border hover:bg-muted/40">
      <InboxIcon kind={item.kind} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <Link
            href={item.href}
            className="truncate text-ds-sm font-medium text-foreground hover:underline"
          >
            {item.title}
          </Link>
          {item.ref ? (
            <ProcurementRefText id={item.ref} className="text-muted-foreground" />
          ) : null}
        </div>
        <p className="truncate text-ds-xs text-muted-foreground">{item.subtitle}</p>
      </div>
      <span className="hidden whitespace-nowrap text-ds-xs text-muted-foreground/70 sm:inline">
        {formatDateTimeMedium(item.timestamp)}
      </span>
      <Button
        render={
          <Link href={item.href} aria-label={`${item.actionLabel} — ${item.title}`} />
        }
        variant="outline"
        size="sm"
        className="h-7 px-2 text-ds-xs opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus-visible:opacity-100"
      >
        {item.actionLabel}
        <ArrowRight className="ml-1 size-3" strokeWidth={1.5} aria-hidden />
      </Button>
    </li>
  );
}

function InboxGroupCard({ group }: { group: InboxData["groups"][number] }) {
  const showAllHref =
    group.id === "drafts"
      ? "/purchase-requests?status=DRAFT"
      : group.id === "awaiting"
        ? "/purchase-requests?status=PENDING_APPROVAL"
        : null;

  return (
    <section className="space-y-3 rounded-xl border border-border-subtle bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-ds-md font-semibold text-foreground">{group.label}</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-ds-2xs font-medium text-muted-foreground">
            {group.total}
          </span>
        </div>
        <p className="text-ds-xs text-muted-foreground">{group.description}</p>
      </div>
      {group.items.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="You're all caught up on this group."
          className="mx-auto max-w-sm py-8"
        />
      ) : (
        <ul className="space-y-1.5">
          {group.items.map((item) => (
            <InboxRow key={item.key} item={item} />
          ))}
        </ul>
      )}
      {showAllHref && group.total > group.items.length ? (
        <div className="pt-1">
          <Link
            href={showAllHref}
            className="inline-flex items-center gap-1 text-ds-xs font-medium text-primary hover:underline"
          >
            View all {group.total}
            <ArrowRight className="size-3" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  tone: "info" | "warning" | "neutral";
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-card p-4">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          TONE_STYLES[tone],
        )}
        aria-hidden
      >
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <div className="flex flex-col">
        <p className="text-ds-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-ds-lg font-semibold tabular-nums text-foreground">{value}</p>
        {hint ? <p className="text-ds-2xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

const QUICK_ACTIONS_BY_ROLE: Record<Role, { label: string; href: string; icon: LucideIcon }[]> = {
  [Role.SM]: [
    { label: "Create PR", href: "/purchase-requests/new", icon: FilePlus },
    { label: "Record GRN", href: "/goods-receipt/new", icon: PackageCheck },
    { label: "Upload invoice", href: "/invoices/new", icon: Receipt },
  ],
  [Role.OPS_HEAD]: [
    { label: "Review approvals", href: "/purchase-requests?status=PENDING_APPROVAL", icon: ClipboardList },
    { label: "Review vendors", href: "/vendors?tab=pending", icon: UserPlus },
    { label: "Create PR", href: "/purchase-requests/new", icon: FilePlus },
  ],
  [Role.FINANCE]: [
    { label: "Pay invoices", href: "/payments?paymentStatus=UNPAID", icon: Receipt },
    { label: "Continue partials", href: "/payments?paymentStatus=PARTIALLY_PAID", icon: Sparkles },
  ],
};

export function InboxView({ role, data }: { role: Role; data: InboxData }) {
  const quickActions = QUICK_ACTIONS_BY_ROLE[role];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        subtitle="One screen, one click — your daily work surfaced and triaged."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {role === Role.SM ? (
          <SummaryTile label="Drafts" value={data.summary.drafts} icon={FileText} tone="neutral" />
        ) : null}
        <SummaryTile
          label="Awaiting action"
          value={data.summary.awaiting}
          icon={Inbox}
          tone="info"
        />
        {role !== Role.SM ? (
          <SummaryTile
            label="At risk"
            value={data.summary.atRisk}
            icon={AlertTriangle}
            tone="warning"
          />
        ) : null}
        <SummaryTile
          label="Recent updates"
          value={data.summary.recent}
          icon={Sparkles}
          tone="neutral"
        />
      </div>

      {quickActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.href}
                render={<Link href={action.href} />}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <Icon className="size-3.5" strokeWidth={1.5} aria-hidden />
                {action.label}
              </Button>
            );
          })}
        </div>
      ) : null}

      <div className="space-y-4">
        {data.groups.map((group) => (
          <InboxGroupCard key={group.id} group={group} />
        ))}
      </div>
    </div>
  );
}
