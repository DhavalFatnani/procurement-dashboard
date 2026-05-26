import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DashboardChrome } from "@/components/dashboard/DashboardChrome";
import { getNavGroupsForRole, ROLE_LABELS } from "@/lib/navigation";
import { timed } from "@/lib/server-timing";
import { getRequestSession } from "@/lib/session";

export async function DashboardLayoutShell({ children }: { children: React.ReactNode }) {
  const user = await timed("layout.getRequestSession", () => getRequestSession());
  if (!user) {
    redirect("/login");
  }

  const displayName =
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    user.email ||
    "User";
  const navGroups = getNavGroupsForRole(user.role);

  return (
    <DashboardChrome
      displayName={displayName}
      role={user.role}
      roleLabel={ROLE_LABELS[user.role]}
      navGroups={navGroups}
    >
      <Suspense>{children}</Suspense>
    </DashboardChrome>
  );
}
