import Link from "next/link";

import {
  SurfaceCard,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import type { POStageDistribution } from "@/lib/queries/dashboard-extras";

/**
 * 6-segment summary bar showing how many POs are at each lifecycle stage.
 *
 * Visually mirrors the per-row POProgressBar — each segment width is
 * proportional to the share of POs at that stage.
 */
export function POStageDistributionCard({
  stages,
}: {
  stages: POStageDistribution[];
}) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <SurfaceCard size="md">
      <SurfaceCardTitle>Purchase orders by stage</SurfaceCardTitle>
      <div className="mt-4 space-y-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted shadow-inner">
          {total === 0
            ? null
            : stages.map((stage, i) => {
                const pct = (stage.count / total) * 100;
                if (pct === 0) return null;
                const intensity = 35 + (i / (stages.length - 1)) * 50;
                return (
                  <span
                    key={stage.status}
                    style={{
                      width: `${pct}%`,
                      background: `color-mix(in srgb, var(--brand-accent) ${intensity}%, transparent)`,
                    }}
                    aria-label={`${stage.label}: ${stage.count}`}
                  />
                );
              })}
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
          {stages.map((stage, i) => {
            const intensity = 35 + (i / (stages.length - 1)) * 50;
            return (
              <li key={stage.status} className="flex items-center gap-2 text-ds-xs">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background: `color-mix(in srgb, var(--brand-accent) ${intensity}%, transparent)`,
                  }}
                  aria-hidden
                />
                <Link
                  href={`/purchase-orders?status=${stage.status}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-1 hover:text-foreground"
                >
                  <span className="truncate text-muted-foreground">{stage.label}</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {stage.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </SurfaceCard>
  );
}
