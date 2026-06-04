"use client";

import { formatInr } from "@/lib/format-datetime";
import {
  deriveCashDue,
  maxAdvanceApplicable,
} from "@/lib/settlement-helpers";
import { cn } from "@/lib/utils";

function BreakdownRow({
  label,
  value,
  emphasis,
  muted,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-ds-sm">
      <span className={cn(muted && "text-muted-foreground", emphasis && "font-medium")}>
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          emphasis ? "font-semibold text-foreground" : "text-foreground",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function SettlementBreakdown({
  invoiceAmount,
  cashPaidOnInvoice,
  advanceAllocatedOnInvoice,
  remaining,
  advanceUnallocatedOnPo,
  advanceAllocation,
  className,
}: {
  invoiceAmount: number;
  cashPaidOnInvoice: number;
  advanceAllocatedOnInvoice: number;
  remaining: number;
  advanceUnallocatedOnPo: number;
  advanceAllocation: number;
  className?: string;
}) {
  const maxAdvance = maxAdvanceApplicable(advanceUnallocatedOnPo, remaining);
  const cashDue = deriveCashDue(remaining, advanceAllocation);
  const settlingNow = advanceAllocation + cashDue;

  return (
    <section
      className={cn(
        "space-y-3 rounded-xl border border-border-subtle bg-card p-4 text-ds-sm",
        className,
      )}
    >
      <p className="font-medium text-foreground">Settlement breakdown</p>
      <div className="space-y-2">
        <BreakdownRow label="Invoice amount" value={formatInr(invoiceAmount)} />
        <BreakdownRow
          label="Already settled"
          value={formatInr(cashPaidOnInvoice + advanceAllocatedOnInvoice)}
          muted
        />
        {(cashPaidOnInvoice > 0 || advanceAllocatedOnInvoice > 0) && (
          <div className="space-y-1 border-l-2 border-border-subtle pl-3">
            {advanceAllocatedOnInvoice > 0 ? (
              <BreakdownRow
                label="Prior advance credit"
                value={formatInr(advanceAllocatedOnInvoice)}
                muted
              />
            ) : null}
            {cashPaidOnInvoice > 0 ? (
              <BreakdownRow
                label="Prior cash payments"
                value={formatInr(cashPaidOnInvoice)}
                muted
              />
            ) : null}
          </div>
        )}
        <BreakdownRow label="Remaining due" value={formatInr(remaining)} emphasis />
        {advanceUnallocatedOnPo > 0 ? (
          <BreakdownRow
            label="PO advance available"
            value={formatInr(advanceUnallocatedOnPo)}
            muted
          />
        ) : null}
      </div>

      {remaining > 0 ? (
        <div className="space-y-2 border-t border-border-subtle pt-3">
          <p className="text-ds-xs font-semibold uppercase tracking-wide text-muted-foreground">
            This settlement
          </p>
          <BreakdownRow
            label="Advance credit"
            value={formatInr(advanceAllocation)}
            emphasis={advanceAllocation > 0}
          />
          <BreakdownRow
            label="Cash payment"
            value={formatInr(cashDue)}
            emphasis={cashDue > 0}
          />
          <BreakdownRow
            label="Total settling now"
            value={formatInr(settlingNow)}
            emphasis
          />
          {maxAdvance > 0 && advanceAllocation > maxAdvance + 0.001 ? (
            <p className="text-ds-xs text-[var(--status-error)]">
              Advance exceeds available credit or remaining balance.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
