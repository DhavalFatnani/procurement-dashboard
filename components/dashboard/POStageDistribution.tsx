import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import type { POStageDistribution } from "@/lib/queries/dashboard-extras";

/**
 * PO lifecycle summary — compact bar + legend, optional per-stage breakdown.
 */
export function POStageDistributionCard({
  stages,
  variant = "compact",
  subtitle,
}: {
  stages: POStageDistribution[];
  variant?: "compact" | "detailed";
  subtitle?: string;
}) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <SurfaceCard size="md" className="w-full">
      <SurfaceCardTitle>Purchase orders by stage</SurfaceCardTitle>
      {subtitle ? (
        <SurfaceCardDescription className="mt-1">{subtitle}</SurfaceCardDescription>
      ) : null}

      <div className="mt-4 space-y-4">
        {total === 0 ? (
          <EmptyState
            size="sm"
            variant="onboarding"
            title="No purchase orders yet"
            description="POs will appear here as they move through receipt, invoicing, and closure."
          />
        ) : (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted shadow-inner">
              {stages.map((stage, i) => {
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

            {variant === "detailed" ? (
              <ul className="space-y-2.5 border-t border-border-subtle pt-4">
                {stages
                  .filter((stage) => stage.count > 0)
                  .map((stage, i) => {
                    const intensity = 35 + (i / (stages.length - 1)) * 50;
                    const barPct = (stage.count / maxCount) * 100;
                    return (
                      <li key={stage.status}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-ds-xs">
                          <Link
                            href={`/purchase-orders?status=${stage.status}`}
                            className="font-medium text-muted-foreground hover:text-foreground"
                          >
                            {stage.label}
                          </Link>
                          <span className="tabular-nums text-foreground">{stage.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${barPct}%`,
                              background: `color-mix(in srgb, var(--brand-accent) ${intensity}%, transparent)`,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </SurfaceCard>
  );
}
