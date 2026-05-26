import { Suspense } from "react";

import { DashboardLayoutFallback } from "@/components/dashboard/DashboardLayoutFallback";
import { DashboardLayoutShell } from "@/components/dashboard/DashboardLayoutShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardLayoutFallback />}>
      <DashboardLayoutShell>{children}</DashboardLayoutShell>
    </Suspense>
  );
}
