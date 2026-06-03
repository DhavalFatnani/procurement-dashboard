import { Role } from "@/lib/prisma-enums";

import { SidebarFinderTrigger } from "@/components/dashboard/SidebarFinderTrigger";
import { SidebarBrand } from "@/components/dashboard/sidebar/SidebarBrand";
import { SidebarFooter } from "@/components/dashboard/sidebar/SidebarFooter";
import { SidebarNav } from "@/components/dashboard/sidebar/SidebarNav";
import { SidebarUser, roleAccentColor } from "@/components/dashboard/sidebar/SidebarUser";
import type { NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar({
  displayName,
  role,
  roleLabel,
  navGroups,
  className,
  onNavigate,
}: {
  displayName: string;
  role: Role;
  roleLabel: string;
  navGroups: NavGroup[];
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-sidebar shrink-0 flex-col overflow-hidden border-r border-border-subtle",
        className,
      )}
      style={{
        background: "var(--gradient-sidebar)",
        borderLeftWidth: 2,
        borderLeftColor: roleAccentColor(role),
      }}
    >
      <SidebarBrand />
      <SidebarUser displayName={displayName} roleLabel={roleLabel} role={role} />
      <div className="px-3 pt-3">
        <SidebarFinderTrigger />
      </div>
      <SidebarNav groups={navGroups} onNavigate={onNavigate} />
      <SidebarFooter />
    </aside>
  );
}
