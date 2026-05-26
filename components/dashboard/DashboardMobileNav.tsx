"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Sidebar } from "@/components/dashboard/sidebar/Sidebar";
import { BrandMark } from "@/components/shared/BrandMark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavGroup } from "@/lib/navigation";
import type { Role } from "@/types";

export function DashboardMobileNav({
  displayName,
  role,
  roleLabel,
  navGroups,
}: {
  displayName: string;
  role: Role;
  roleLabel: string;
  navGroups: NavGroup[];
}) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border-subtle surface-glass px-4 lg:hidden">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-full"
              aria-label="Open navigation menu"
            >
              <Menu className="size-4" strokeWidth={1.5} />
            </Button>
          }
        />
        <SheetContent side="left" className="w-sidebar border-border-subtle p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <Sidebar
            className="flex h-full"
            displayName={displayName}
            role={role}
            roleLabel={roleLabel}
            navGroups={navGroups}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <BrandMark size="sm" />
      <span className="ml-auto text-ds-xs font-medium text-muted-foreground">
        {roleLabel}
      </span>
    </header>
  );
}
