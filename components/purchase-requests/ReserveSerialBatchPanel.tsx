"use client";

import { ExecutionTypeBadge } from "@/components/shared/ExecutionTypeBadge";
import { ExecutionType } from "@prisma/client";
import { ArrowRight, Hash, Tags, Warehouse } from "lucide-react";

export function ReserveSerialBatchPanel({
  batchLabel,
  rangeStart,
  rangeEnd,
  quantity,
  seriesPrefix,
  seriesName,
  categoryName,
  warehouseLabel,
}: {
  batchLabel: string;
  rangeStart: string;
  rangeEnd: string;
  quantity: number;
  seriesPrefix: string;
  seriesName: string;
  categoryName?: string;
  warehouseLabel: string;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
            Step 1
          </span>
          <ExecutionTypeBadge type={ExecutionType.INTERNAL_PRINT} />
        </div>
        <div>
          <h3 className="text-ds-md font-semibold tracking-tight text-foreground">
            Review batch
          </h3>
          <p className="mt-1 text-ds-sm leading-relaxed text-muted-foreground">{batchLabel}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-ds">
        <p className="text-ds-xs font-medium text-muted-foreground">Quantity</p>
        <p className="mt-1 font-mono text-ds-metric tabular-nums tracking-tight text-foreground">
          {quantity}
        </p>
        <p className="mt-0.5 text-ds-xs text-muted-foreground">
          serial {quantity === 1 ? "number" : "numbers"} · 1 per printed page
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assigned range
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="rounded-xl border border-border-subtle bg-muted/25 px-3 py-3 text-center">
            <p className="text-ds-2xs text-muted-foreground">Start</p>
            <p className="mt-1 break-all font-mono text-ds-sm font-semibold tabular-nums text-foreground">
              {rangeStart}
            </p>
          </div>
          <ArrowRight
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
          <div className="rounded-xl border border-border-subtle bg-muted/25 px-3 py-3 text-center">
            <p className="text-ds-2xs text-muted-foreground">End</p>
            <p className="mt-1 break-all font-mono text-ds-sm font-semibold tabular-nums text-foreground">
              {rangeEnd}
            </p>
          </div>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-mono text-ds-2xs text-muted-foreground">
          <Hash className="size-3" strokeWidth={1.5} aria-hidden />
          Prefix {seriesPrefix}
        </p>
      </div>

      <ul className="mt-auto space-y-2.5 border-t border-border-subtle pt-4">
        <li className="flex gap-3">
          <Tags
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-ds-xs text-muted-foreground">Series</p>
            <p className="text-ds-sm font-medium text-foreground">{seriesName}</p>
            {categoryName ? (
              <p className="text-ds-xs text-muted-foreground">{categoryName}</p>
            ) : null}
          </div>
        </li>
        <li className="flex gap-3">
          <Warehouse
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-ds-xs text-muted-foreground">Warehouse</p>
            <p className="text-ds-sm font-medium text-foreground">{warehouseLabel}</p>
          </div>
        </li>
      </ul>
    </div>
  );
}
