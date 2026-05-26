"use client";

import type { SeriesUsageSummary } from "@/lib/serial-governance-types";
import { SurfaceCard } from "@/components/shared/SurfaceCard";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

export function SerialSummaryTab({ summaries }: { summaries: SeriesUsageSummary[] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {summaries.map((card) => (
          <NextAllotmentCard key={card.series} card={card} />
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-ds-sm font-semibold">Usage by warehouse</h2>
          <p className="mt-1 text-ds-xs text-muted-foreground">
            Where each series has been reserved — ledger allocations, not in-store consumption.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {summaries.map((card) => (
            <WarehouseUsageCard key={card.series} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NextAllotmentCard({ card }: { card: SeriesUsageSummary }) {
  const utilizedThrough = card.lastRangeEnd ?? card.seriesStart;

  return (
    <SurfaceCard className="flex flex-col gap-4 p-5">
      <div>
        <p className="text-ds-sm font-semibold">{card.displayName}</p>
        <p className="text-ds-xs text-muted-foreground">
          Prefix band <span className="font-mono">{card.prefix}</span>
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-ds-2xs font-medium uppercase tracking-wider text-muted-foreground">
          Next allotment starts at
        </p>
        <p className="font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {card.nextStart}
        </p>
      </div>

      <div className="space-y-3 border-t border-border-subtle pt-4 text-ds-sm">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Utilized through</span>
          <span className="font-mono text-ds-xs font-medium">{utilizedThrough}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Ranges reserved</span>
          <span className="font-medium">{card.reservationCount}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Pool allocated</span>
          <span className="font-medium">{card.usedPct.toFixed(2)}%</span>
        </div>
        {card.lastEventAt ? (
          <p className="text-ds-xs text-muted-foreground">
            Last {card.lastEventType?.toLowerCase() ?? "reservation"} on{" "}
            {formatDateTimeMedium(card.lastEventAt)}
            {card.lastEventBy ? ` by ${card.lastEventBy}` : ""}
          </p>
        ) : (
          <p className="text-ds-xs text-muted-foreground">No reservations yet</p>
        )}
      </div>

      <div className="mt-auto">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[var(--brand-accent)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, card.usedPct))}%` }}
          />
        </div>
      </div>
    </SurfaceCard>
  );
}

function WarehouseUsageCard({ card }: { card: SeriesUsageSummary }) {
  return (
    <SurfaceCard className="p-4">
      <p className="text-ds-sm font-semibold">{card.displayName}</p>
      {card.warehouseUsage.length === 0 ? (
        <p className="mt-3 text-ds-sm text-muted-foreground">No warehouse activity yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border-subtle">
          {card.warehouseUsage.map((row) => (
            <li
              key={row.warehouseId}
              className={cn("flex items-start justify-between gap-3 py-2.5 text-ds-sm first:pt-0 last:pb-0")}
            >
              <div>
                <p className="font-medium">{row.warehouseName}</p>
                <p className="text-ds-xs text-muted-foreground">
                  {row.reservationCount} reservation{row.reservationCount === 1 ? "" : "s"}
                </p>
              </div>
              <p className="font-mono text-ds-xs text-muted-foreground">
                {row.lastRangeEnd ?? "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  );
}
