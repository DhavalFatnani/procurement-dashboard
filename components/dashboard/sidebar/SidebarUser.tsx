import Link from "next/link";
import { Role } from "@/lib/prisma-enums";
import { ChevronRight } from "lucide-react";

import { Avatar } from "@/components/shared/Avatar";
import { cn } from "@/lib/utils";

const ROLE_ACCENT: Record<Role, string> = {
  [Role.SM]: "var(--accent-role-sm)",
  [Role.OPS_HEAD]: "var(--accent-role-ops)",
  [Role.FINANCE]: "var(--accent-role-finance)",
  [Role.ADMIN]: "var(--accent-role-ops)",
};

export function SidebarUser({
  displayName,
  roleLabel,
  role,
  className,
}: {
  displayName: string;
  roleLabel: string;
  role: Role;
  className?: string;
}) {
  const accent = ROLE_ACCENT[role];

  return (
    <Link
      href="/profile"
      className={cn(
        "group block border-b border-border-subtle px-4 py-3 transition-colors hover:bg-foreground/[0.03]",
        className,
      )}
      style={{ borderLeftWidth: 2, borderLeftColor: accent }}
      aria-label="Open profile"
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={displayName} size="md" />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-ds-sm font-medium text-foreground"
            title={displayName}
          >
            {displayName}
          </p>
          <span
            className="mt-0.5 inline-flex rounded-full px-2 py-0.5 text-ds-2xs font-medium"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, transparent)`,
              color: accent,
            }}
          >
            {roleLabel}
          </span>
        </div>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    </Link>
  );
}

export function roleAccentColor(role: Role): string {
  return ROLE_ACCENT[role];
}
