"use client";

import { pendingQtyForPo } from "@/lib/po-receiving-lines";
import type { PODetail } from "@/lib/queries/purchase-orders";

export function PODetailReceivingContext({ po }: { po: PODetail }) {
  const ordered = po.reconciliation.ordered;
  const accepted = po.reconciliation.received;
  const pending = pendingQtyForPo(ordered, accepted);

  return (
    <div className="section-stack">
      {po.openDisputeCount > 0 ? (
        <div className="rounded-lg border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] px-4 py-3 text-ds-sm">
          <p className="font-medium text-[var(--status-warning)]">
            {po.openDisputeCount} open dispute{po.openDisputeCount === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-muted-foreground">
            Resolve every GRN dispute before uploading invoices. Receiving can
            continue where pending quantity allows.
          </p>
        </div>
      ) : po.grns.length > 0 ? (
        <div className="rounded-lg border border-[var(--status-success)]/30 bg-[var(--status-success-bg)] px-4 py-3 text-ds-sm text-[var(--status-success)]">
          Disputes cleared — this PO is ready for invoice upload (partial or full).
        </div>
      ) : null}

      <div className="rounded-lg border border-border-subtle bg-card px-4 py-3 shadow-ds">
        <div className="grid gap-3 text-ds-sm sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Ordered (effective)" value={ordered} />
          <Metric label="Accepted" value={accepted} tone="success" />
          <Metric label="Pending" value={pending} tone={pending > 0 ? "warning" : undefined} />
          <Metric
            label="Open disputes"
            value={po.openDisputeCount}
            tone={po.openDisputeCount > 0 ? "error" : undefined}
          />
        </div>
        <p className="mt-2 text-ds-xs text-muted-foreground">
          Accepted = invoicable quantity across all goods receipts.
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "error";
}) {
  return (
    <div>
      <p className="text-ds-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          tone === "success"
            ? "mt-0.5 font-tabular text-lg font-semibold text-status-success"
            : tone === "warning"
              ? "mt-0.5 font-tabular text-lg font-semibold text-status-warning"
              : tone === "error"
                ? "mt-0.5 font-tabular text-lg font-semibold text-status-error"
                : "mt-0.5 font-tabular text-lg font-semibold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}
