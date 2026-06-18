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
  LayoutTemplate,
  LayoutDashboard,
  ListChecks,
  PackageCheck,
  Receipt,
  Tags,
  Users,
  Wallet,
  Warehouse,
  Boxes,
  type LucideIcon,
} from "lucide-react";

import type { NavGroup, NavIconId, NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<NavIconId, LucideIcon> = {
  inbox: Inbox,
  dashboard: LayoutDashboard,
  vendors: Building2,
  purchaseRequests: FileText,
  configurePO: ListChecks,
  purchaseOrders: ClipboardList,
  goodsReceipt: PackageCheck,
  invoices: Receipt,
  payments: Wallet,
  serialGovernance: Hash,
  labelStudio: LayoutTemplate,
  binLabels: Boxes,
  reports: BarChart3,
  users: Users,
  warehouses: Warehouse,
  catalog: Tags,
};

function NavLink({
  item,
  active,
  onNavigate,
  nested = false,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const Icon = NAV_ICONS[item.icon];
  return (
    <Link
      href={item.href}
      onClick={() => onNavigate?.()}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-full text-ds-sm",
        "transition-[background,color,box-shadow,transform] duration-fast ease-out",
        nested ? "h-8 px-3" : "h-9 px-3",
        active
          ? "bg-secondary font-medium text-foreground shadow-ds"
          : "text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "shrink-0 transition-colors duration-fast",
          nested ? "size-3.5" : "size-4",
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

function NavItemTree({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  const childActive = item.children?.some((child) => isActive(child.href)) ?? false;
  const parentActive = isActive(item.href) || childActive;

  if (!item.children?.length) {
    return (
      <NavLink item={item} active={isActive(item.href)} onNavigate={onNavigate} />
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <NavLink item={item} active={parentActive} onNavigate={onNavigate} />
      <div
        className="ml-4 flex flex-col gap-0.5 border-l border-border-subtle/80 pl-2"
        role="group"
        aria-label={`${item.label} fulfillment`}
      >
        {item.children.map((child) => (
          <NavLink
            key={child.href}
            item={child}
            active={isActive(child.href)}
            onNavigate={onNavigate}
            nested
          />
        ))}
      </div>
    </div>
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
  const hasActiveChild = group.items.some(
    (item) =>
      isActive(item.href) ||
      item.children?.some((child) => isActive(child.href)),
  );
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
            <NavItemTree
              key={item.href}
              item={item}
              isActive={isActive}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function collectHrefs(items: NavItem[]): string[] {
  return items.flatMap((item) =>
    item.children ? [item.href, ...item.children.map((child) => child.href)] : [item.href],
  );
}

function resolveActiveHref(pathname: string, allHrefs: string[]): string | undefined {
  const sorted = [...allHrefs].sort((a, b) => b.length - a.length);
  return sorted.find((href) => pathname === href || pathname.startsWith(`${href}/`));
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
  const allHrefs = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.flatMap((group) => collectHrefs(group.items));
    }
    return collectHrefs(items ?? []);
  }, [groups, items]);
  const activeHref = React.useMemo(
    () => resolveActiveHref(pathname, allHrefs),
    [pathname, allHrefs],
  );
  const isActive = (href: string) => href === activeHref;

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
        <NavItemTree
          key={item.href}
          item={item}
          isActive={isActive}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

/** @deprecated Use SidebarNav — kept for gradual migration. */
export { SidebarNav as DashboardNavLinks };
