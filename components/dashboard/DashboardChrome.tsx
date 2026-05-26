import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";
import { Sidebar } from "@/components/dashboard/sidebar/Sidebar";
import { DashboardUiProvider } from "@/components/providers/dashboard-ui-provider";
import { PageTransition } from "@/components/shared/PageTransition";
import type { NavGroup } from "@/lib/navigation";
import type { Role } from "@/types";

export function DashboardChrome({
  displayName,
  role,
  roleLabel,
  navGroups,
  children,
}: {
  displayName: string;
  role: Role;
  roleLabel: string;
  navGroups: NavGroup[];
  children: React.ReactNode;
}) {
  return (
    <DashboardUiProvider role={role}>
      <div className="flex min-h-screen w-full bg-shell-gradient">
        <Sidebar
          className="hidden lg:flex"
          displayName={displayName}
          role={role}
          roleLabel={roleLabel}
          navGroups={navGroups}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardMobileNav
            displayName={displayName}
            role={role}
            roleLabel={roleLabel}
            navGroups={navGroups}
          />

          <main className="mx-auto w-full max-w-content flex-1 px-4 py-8 md:px-8">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </DashboardUiProvider>
  );
}
