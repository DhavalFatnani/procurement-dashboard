"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  Hash,
  Inbox,
  LayoutDashboard,
  PackageCheck,
  Receipt,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import type { NavGroup, NavIconId, NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<NavIconId, LucideIcon> = {
  inbox: Inbox,
  dashboard: LayoutDashboard,
  vendors: Building2,
  purchaseRequests: FileText,
  purchaseOrders: ClipboardList,
  goodsReceipt: PackageCheck,
  invoices: Receipt,
  payments: Wallet,
  serialGovernance: Hash,
  reports: BarChart3,
  users: Users,
  warehouses: Warehouse,
};

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={() => onNavigate?.()}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-full px-3 text-ds-sm",
        "transition-[background,color,box-shadow,transform] duration-fast ease-out",
        active
          ? "bg-secondary font-medium text-foreground shadow-ds"
          : "text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors duration-fast",
          active ? "text-[var(--brand-accent)]" : "text-muted-foreground group-hover:text-foreground",
        )}
        strokeWidth={1.5}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
      {item.hint ? (
        <span className="ml-auto text-ds-2xs font-normal uppercase tracking-wide text-muted-foreground/70">
          {item.hint}
        </span>
      ) : null}
    </Link>
  );
}

function NavGroupSection({
  group,
  isActive,
  onNavigate,
  defaultOpen = true,
}: {
  group: NavGroup;
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
  defaultOpen?: boolean;
}) {
  const hasActiveChild = group.items.some((item) => isActive(item.href));
  const [open, setOpen] = React.useState(defaultOpen || hasActiveChild);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-ds-2xs font-semibold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-muted-foreground"
        aria-expanded={open}
      >
        {group.label}
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-fast",
            open ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SidebarNav({
  items,
  groups,
  onNavigate,
}: {
  items?: NavItem[];
  groups?: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  if (groups && groups.length > 0) {
    return (
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3" aria-label="Main">
        {groups.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            isActive={isActive}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3" aria-label="Main">
      {(items ?? []).map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActive(item.href)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

/** @deprecated Use SidebarNav — kept for gradual migration. */
export { SidebarNav as DashboardNavLinks };
