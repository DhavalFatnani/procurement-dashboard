import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { checkRole } from "@/lib/auth";
import { getNavItemsForRole, ROLE_LABELS } from "@/lib/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await checkRole([]);
  const displayName =
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    user.email ||
    "User";
  const navItems = getNavItemsForRole(user.role);

  return (
    <DashboardShell
      displayName={displayName}
      role={user.role}
      roleLabel={ROLE_LABELS[user.role]}
      navItems={navItems}
    >
      {children}
    </DashboardShell>
  );
}
