"use client";

import type { WarehouseSeriesSnapshot } from "@/lib/serial-governance-types";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SerialWarehouseTab({ snapshots }: { snapshots: WarehouseSeriesSnapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <EmptyState
        title="No warehouse data"
        description="No serial reservations have been recorded yet."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {snapshots.map((snapshot) => (
        <Card key={snapshot.warehouseId} size="sm">
          <CardHeader>
            <CardTitle className="text-ds-base">{snapshot.warehouseName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border-subtle">
              {snapshot.seriesRows.map((row) => (
                <dl
                  key={row.series}
                  className="grid gap-1 py-3 text-ds-sm first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div>
                    <dt className="font-medium">{row.displayName}</dt>
                    <dd className="mt-1 text-ds-xs text-muted-foreground">
                      {row.reservationCount === 0
                        ? "No reservations yet"
                        : `${row.reservationCount} reservation${row.reservationCount === 1 ? "" : "s"}`}
                    </dd>
                  </div>
                  <div className="text-right sm:text-ds-xs">
                    <dd className="font-mono">{row.lastRangeEnd ?? "—"}</dd>
                    {row.lastEventAt ? (
                      <dd className="mt-1 text-muted-foreground">
                        {formatDateTimeMedium(row.lastEventAt)}
                        {row.lastEventBy ? ` · ${row.lastEventBy}` : ""}
                      </dd>
                    ) : null}
                  </div>
                </dl>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
