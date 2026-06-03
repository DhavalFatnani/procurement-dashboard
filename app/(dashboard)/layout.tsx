import { Suspense } from "react";

import { DashboardLayoutFallback } from "@/components/dashboard/DashboardLayoutFallback";
import { DashboardLayoutShell } from "@/components/dashboard/DashboardLayoutShell";

/**
 * Colocate dashboard compute with the database to kill cross-region latency.
 *
 * The Supabase instance lives in `aws-1-ap-southeast-2` (Sydney). Every page
 * here makes multiple DB round-trips; if functions run in the US default region
 * each round-trip costs ~150-250ms instead of ~5-15ms. Pinning to `syd1` (the
 * Vercel region in the same AWS zone) cuts per-query latency by ~20x and applies
 * to all dashboard route segments and their Server Actions.
 *
 * NOTE: keep this in sync with the database region. If the DB moves, update this.
 */
export const preferredRegion = "syd1";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardLayoutFallback />}>
      <DashboardLayoutShell>{children}</DashboardLayoutShell>
    </Suspense>
  );
}
