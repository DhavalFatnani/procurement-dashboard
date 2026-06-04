"use client";

import Link from "next/link";

import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/shared/Field";
import { Input } from "@/components/ui/input";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { formatInr } from "@/lib/format-datetime";
import { maxAdvanceApplicable } from "@/lib/settlement-helpers";

export type AdvanceCreditDecision =
  | "pending"
  | "apply_max"
  | "skip"
  | "custom"
  | "custom_applied";

export function AdvanceCreditPrompt({
  poId,
  remaining,
  advanceUnallocatedOnPo,
  decision,
  customAmount,
  disabled,
  pendingAdvanceRequestTotal,
  firstPendingAdvanceRequestId,
  advanceAllocation,
  onApplyMax,
  onSkip,
  onStartCustom,
  onCustomAmountChange,
  onConfirmCustom,
  onChangeDecision,
}: {
  poId: string;
  remaining: number;
  advanceUnallocatedOnPo: number;
  decision: AdvanceCreditDecision;
  customAmount: string;
  advanceAllocation: string;
  disabled?: boolean;
  pendingAdvanceRequestTotal: number;
  firstPendingAdvanceRequestId: string | null;
  onApplyMax: () => void;
  onSkip: () => void;
  onStartCustom: () => void;
  onCustomAmountChange: (value: string) => void;
  onConfirmCustom: () => void;
  onChangeDecision: () => void;
}) {
  const maxApplicable = maxAdvanceApplicable(advanceUnallocatedOnPo, remaining);

  if (maxApplicable <= 0) {
    if (pendingAdvanceRequestTotal > 0 && firstPendingAdvanceRequestId) {
      return (
        <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-ds-sm">
          <p className="font-medium text-foreground">No advance credit available yet</p>
          <p className="mt-1 text-muted-foreground">
            {formatInr(pendingAdvanceRequestTotal)} advance requested on{" "}
            <ProcurementRefLink id={poId} className="font-medium" /> — pay the vendor
            advance first to create credit for invoice settlement.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            render={
              <Link
                href={`${FINANCE_ROUTES.vendorAdvances}?advanceRequestId=${encodeURIComponent(firstPendingAdvanceRequestId)}`}
              />
            }
          >
            Pay vendor advance
          </Button>
        </div>
      );
    }
    return null;
  }

  if (decision !== "pending" && decision !== "custom") {
    const applied =
      decision === "apply_max"
        ? maxApplicable
        : decision === "skip"
          ? 0
          : Number(advanceAllocation) || 0;
    return (
      <div className="rounded-xl border border-border-subtle bg-muted/30 px-4 py-3 text-ds-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">Advance credit</p>
            <p className="mt-1 text-muted-foreground">
              {decision === "skip"
                ? "Paying this invoice in cash only — no advance credit applied."
                : `Applying ${formatInr(applied)} advance credit from ${formatInr(advanceUnallocatedOnPo)} available on PO.`}
            </p>
          </div>
          {!disabled ? (
            <Button type="button" size="sm" variant="ghost" onClick={onChangeDecision}>
              Change
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (decision === "custom") {
    return (
      <div className="space-y-3 rounded-xl border border-border-subtle bg-card px-4 py-4 text-ds-sm">
        <div>
          <p className="font-medium text-foreground">Custom advance amount</p>
          <p className="mt-1 text-muted-foreground">
            Enter how much PO advance credit to apply (up to {formatInr(maxApplicable)}).
          </p>
        </div>
        <Field
          label="Advance credit to apply"
          htmlFor="advance-custom-amount"
          hint={`Up to ${formatInr(maxApplicable)}`}
        >
          <Input
            id="advance-custom-amount"
            type="number"
            step="0.01"
            min="0"
            max={maxApplicable}
            value={customAmount}
            onChange={(e) => onCustomAmountChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onChangeDecision}>
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled || !(Number(customAmount) > 0)}
            onClick={onConfirmCustom}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-4 py-4 text-ds-sm">
      <div>
        <p className="font-medium text-foreground">Apply advance credit?</p>
        <p className="mt-1 text-muted-foreground">
          {formatInr(advanceUnallocatedOnPo)} unallocated advance is available on{" "}
          <ProcurementRefLink id={poId} className="font-medium" />.
        </p>
        <p className="mt-1 text-muted-foreground">
          Apply up to {formatInr(maxApplicable)} toward this invoice&apos;s{" "}
          {formatInr(remaining)} remaining balance?
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={onApplyMax}>
          Apply max ({formatInr(maxApplicable)})
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onStartCustom}>
          Custom amount
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onSkip}>
          Skip — pay in cash only
        </Button>
      </div>
    </div>
  );
}
