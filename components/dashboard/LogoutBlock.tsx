"use client";

import { LogOut } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sign-out button.
 *
 * - default: rendered as its own bordered block (legacy mobile-nav usage)
 * - `embedded`: no border / padding wrapper (used inside SidebarFooter which
 *   already provides a top border + padding)
 */
export function LogoutBlock({
  className,
  embedded = false,
}: {
  className?: string;
  embedded?: boolean;
}) {
  const button = (
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
  );

  if (embedded) {
    return button;
  }

  return (
    <div className={cn("border-t border-border-subtle p-3", className)}>{button}</div>
  );
}
