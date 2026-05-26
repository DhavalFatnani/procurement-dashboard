"use client";

import { Search } from "lucide-react";

import { useDashboardUi } from "@/components/providers/dashboard-ui-provider";
import { KBD } from "@/components/shared/KBD";
import { cn } from "@/lib/utils";

/**
 * Sidebar search affordance that opens the global ⌘K finder.
 */
export function SidebarFinderTrigger({ className }: { className?: string }) {
  const { openCommandPalette } = useDashboardUi();
  return (
    <button
      type="button"
      onClick={() => openCommandPalette()}
      aria-label="Open finder — search or jump to"
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-full border border-border-subtle",
        "bg-[color-mix(in_srgb,var(--surface-2)_90%,transparent)] px-3",
        "text-ds-sm text-muted-foreground shadow-ds",
        "transition-[background,color,box-shadow,transform] duration-fast",
        "hover:border-border-default hover:text-foreground hover:shadow-ds-2",
        className,
      )}
    >
      <Search className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
      <span className="flex-1 truncate text-left">Search or jump to…</span>
      <KBD className="hidden sm:inline-flex">⌘K</KBD>
    </button>
  );
}
