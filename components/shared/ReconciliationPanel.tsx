"use client";

import { cn } from "@/lib/utils";

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export type ReconciliationMetrics = {
  ordered: number;
  received: number;
  invoiced: number;
  paid: number;
};

export type ClosureCheck = {
  id: string;
  label: string;
  done: boolean;
};

function ratioTone(ratio: number) {
  if (ratio >= 1) {
    return "text-status-success";
  }
  if (ratio > 0) {
    return "text-status-warning";
  }
  return "text-muted-foreground";
}

function MetricColumn({
  label,
  value,
  context,
  valueClassName,
}: {
  label: string;
  value: string | number;
  context?: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 text-[22px] font-semibold font-tabular text-foreground", valueClassName)}>
        {value}
      </p>
      {context ? <p className="mt-0.5 text-ds-xs text-muted-foreground">{context}</p> : null}
    </div>
  );
}

export function ReconciliationPanel({
  metrics,
  closureChecks,
}: {
  metrics: ReconciliationMetrics;
  closureChecks?: ClosureCheck[];
}) {
  const receivedRatio = metrics.ordered > 0 ? metrics.received / metrics.ordered : 0;
  const paidRatio = metrics.invoiced > 0 ? metrics.paid / metrics.invoiced : 0;

  return (
    <div className="rounded-lg border border-border-subtle bg-card px-6 py-5">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricColumn label="Ordered" value={metrics.ordered} />
        <MetricColumn
          label="Received"
          value={metrics.received}
          valueClassName={ratioTone(receivedRatio)}
          context={
            metrics.ordered > 0
              ? `${Math.round(receivedRatio * 100)}% of ordered`
              : undefined
          }
        />
        <MetricColumn label="Invoiced" value={metrics.invoiced} />
        <MetricColumn
          label="Paid"
          value={metrics.paid}
          valueClassName={ratioTone(paidRatio)}
          context={
            metrics.invoiced > 0 ? `${Math.round(paidRatio * 100)}% of invoiced` : undefined
          }
        />
      </div>

      {closureChecks && closureChecks.length > 0 ? (
        <>
          <div className="my-4 border-t border-border-subtle" />
          <div className="grid gap-3 sm:grid-cols-2">
            {closureChecks.map((check) => (
              <div key={check.id} className="flex items-center gap-2 text-ds-sm">
                {check.done ? (
                  <CheckCircleIcon className="size-4 shrink-0 text-status-success" />
                ) : (
                  <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={check.done ? "text-foreground" : "text-muted-foreground"}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
