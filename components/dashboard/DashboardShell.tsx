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
import { Badge } from "@/components/ui/badge";
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
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Main">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
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
    <div className="border-b px-4 py-4">
      <p className="text-sm font-semibold tracking-tight">KNOT Procurement</p>
      <p className="mt-2 truncate text-sm text-muted-foreground" title={displayName}>
        {displayName}
      </p>
      <Badge variant="secondary" className="mt-2">
        {roleLabel}
      </Badge>
    </div>
  );
}

function LogoutBlock({ className }: { className?: string }) {
  return (
    <div className={cn("border-t p-3", className)}>
      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full justify-start gap-2" size="default">
          <LogOut className="size-4" aria-hidden />
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
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <BrandAndUser displayName={displayName} roleLabel={roleLabel} />
        <SidebarNav items={navItems} pathname={pathname} />
        <LogoutBlock className="mt-auto" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 lg:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon" aria-label="Open navigation menu" />
              }
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
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
          <span className="text-sm font-semibold">KNOT Procurement</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {role}
          </Badge>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
