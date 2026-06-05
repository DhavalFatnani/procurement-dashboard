"use client";

import { LogOut } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

/**
 * Sign-out button.
 *
 * Uses the browser Supabase client (not a server action) so the sidebar shell
 * does not break when other auth actions change during dev HMR.
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
  const [pending, setPending] = React.useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      window.location.assign("/login");
    } catch {
      setPending(false);
    }
  }

  const button = (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() => void handleSignOut()}
      className="h-8 w-full justify-start gap-2 px-2 text-ds-sm text-muted-foreground hover:text-foreground"
    >
      <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
      {pending ? "Signing out…" : "Log out"}
    </Button>
  );

  if (embedded) {
    return button;
  }

  return (
    <div className={cn("border-t border-border-subtle p-3", className)}>{button}</div>
  );
}
