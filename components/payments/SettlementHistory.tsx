"use client";

import type {
  AdvanceAllocationEntry,
  PaymentEntry,
} from "@/lib/queries/payments";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import { SheetSection } from "@/components/shared/SheetSection";

type SettlementHistoryEntry =
  | {
      kind: "cash";
      id: string;
      amount: string;
      paidAt: string | null;
      label: string;
      detail: string;
      proofSignedUrl: string | null;
    }
  | {
      kind: "advance";
      id: string;
      amount: string;
      paidAt: string | null;
      label: string;
      detail: string;
    };

function buildHistoryEntries(
  payments: PaymentEntry[],
  advanceAllocations: AdvanceAllocationEntry[],
): SettlementHistoryEntry[] {
  const cashEntries: SettlementHistoryEntry[] = payments.map((p) => ({
    kind: "cash" as const,
    id: p.id,
    amount: p.amount,
    paidAt: p.paidAt,
    label: "Cash payment",
    detail: [p.method, p.transactionRef ? `Txn ${p.transactionRef}` : null, p.paidByName]
      .filter(Boolean)
      .join(" · "),
    proofSignedUrl: p.proofSignedUrl,
  }));

  const advanceEntries: SettlementHistoryEntry[] = advanceAllocations.map((a) => ({
    kind: "advance" as const,
    id: a.id,
    amount: a.amount,
    paidAt: a.createdAt,
    label: "Advance credit",
    detail: "Applied from PO advance wallet",
  }));

  return [...cashEntries, ...advanceEntries].sort((a, b) => {
    const ta = a.paidAt ? new Date(a.paidAt).getTime() : 0;
    const tb = b.paidAt ? new Date(b.paidAt).getTime() : 0;
    return tb - ta;
  });
}

export function SettlementHistory({
  payments,
  advanceAllocations,
}: {
  payments: PaymentEntry[];
  advanceAllocations: AdvanceAllocationEntry[];
}) {
  const entries = buildHistoryEntries(payments, advanceAllocations);
  if (entries.length === 0) {
    return null;
  }

  return (
    <SheetSection title="Settlement history">
      <ol className="space-y-2">
        {entries.map((entry) => (
          <li
            key={`${entry.kind}-${entry.id}`}
            className="flex items-start gap-3 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm"
          >
            <span
              className={`mt-1 size-2 shrink-0 rounded-full ${
                entry.kind === "advance"
                  ? "bg-[var(--status-info)]"
                  : "bg-[var(--status-success)]"
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">{entry.label}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatInr(entry.amount)}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-ds-xs text-muted-foreground">
                {entry.paidAt ? <span>{formatDateMedium(entry.paidAt)}</span> : null}
                {entry.detail ? <span>· {entry.detail}</span> : null}
              </div>
              {entry.kind === "cash" && entry.proofSignedUrl ? (
                <a
                  href={entry.proofSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-ds-xs text-primary hover:underline"
                >
                  View proof →
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </SheetSection>
  );
}
