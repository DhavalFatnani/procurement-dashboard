"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  Hash,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavIconId, NavItem } from "@/lib/navigation";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<NavIconId, LucideIcon> = {
  dashboard: LayoutDashboard,
  vendors: Building2,
  purchaseRequests: FileText,
  purchaseOrders: ClipboardList,
  goodsReceipt: PackageCheck,
  invoices: Receipt,
  payments: Wallet,
  serialGovernance: Hash,
  reports: BarChart3,
};

function SidebarNav({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3" aria-label="Main">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={cn(
              "relative flex h-8 items-center gap-2 rounded-md px-2 text-ds-sm font-normal transition-[background,color] duration-fast",
              active
                ? "border-l-2 border-primary bg-secondary pl-[calc(0.5rem-2px)] text-foreground"
                : "border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function BrandAndUser({
  displayName,
  roleLabel,
}: {
  displayName: string;
  roleLabel: string;
}) {
  return (
    <div className="border-b border-border-subtle px-3 py-4">
      <p className="text-ds-2xs font-medium uppercase tracking-widest text-muted-foreground/80">
        KNOT
      </p>
      <p className="text-ds-sm font-medium text-foreground">Procurement</p>
      <p className="mt-3 truncate text-ds-sm text-muted-foreground" title={displayName}>
        {displayName}
      </p>
      <span className="mt-2 inline-flex rounded px-2 py-0.5 text-ds-xs font-medium bg-secondary text-muted-foreground">
        {roleLabel}
      </span>
    </div>
  );
}

function LogoutBlock({ className }: { className?: string }) {
  return (
    <div className={cn("border-t border-border-subtle p-3", className)}>
      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          className="h-8 w-full justify-start gap-2 px-2 text-ds-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
          Log out
        </Button>
      </form>
    </div>
  );
}

export function DashboardShell({
  displayName,
  role,
  roleLabel,
  navItems,
  children,
}: {
  displayName: string;
  role: Role;
  roleLabel: string;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen w-full bg-[var(--bg-app)]">
      <aside className="hidden w-sidebar shrink-0 flex-col border-r border-border-subtle bg-card lg:flex">
        <BrandAndUser displayName={displayName} roleLabel={roleLabel} />
        <SidebarNav items={navItems} pathname={pathname} />
        <LogoutBlock className="mt-auto" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-border-subtle bg-background px-4 lg:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon" className="size-8" aria-label="Open navigation menu">
                  <Menu className="size-4" strokeWidth={1.5} />
                </Button>
              }
            />
            <SheetContent side="left" className="w-sidebar border-border-subtle bg-card p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <BrandAndUser displayName={displayName} roleLabel={roleLabel} />
              <SidebarNav
                items={navItems}
                pathname={pathname}
                onNavigate={() => setMobileNavOpen(false)}
              />
              <LogoutBlock />
            </SheetContent>
          </Sheet>
          <span className="text-ds-sm font-medium">Procurement</span>
          <span className="ml-auto text-ds-xs text-muted-foreground">{role}</span>
        </header>

        <main className="mx-auto w-full max-w-content flex-1 px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
