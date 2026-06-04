"use client";

import { InvoiceMatchStatus, PaymentStatus } from "@/lib/prisma-enums";
import { FileText } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { recordPayment } from "@/app/actions/payments";
import {
  AdvanceCreditPrompt,
  type AdvanceCreditDecision,
} from "@/components/payments/AdvanceCreditPrompt";
import { CashTransferFields } from "@/components/payments/CashTransferFields";
import { SettlementBreakdown } from "@/components/payments/SettlementBreakdown";
import { SettlementHistory } from "@/components/payments/SettlementHistory";
import { VendorBankDetailsCard } from "@/components/payments/VendorBankDetailsCard";
import { Chip } from "@/components/shared/Chip";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { ProgressRing } from "@/components/shared/ProgressRing";
import { SheetSection } from "@/components/shared/SheetSection";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import type { InvoicePaymentDetail } from "@/lib/queries/payments";
import {
  confirmSettlementLabel,
  deriveCashDue,
  maxAdvanceApplicable,
} from "@/lib/settlement-helpers";

function DetailRow({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-ds-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function resetSettlementForm(
  setAdvanceAllocation: (v: string) => void,
  setAdvanceDecision: (v: AdvanceCreditDecision) => void,
  setCustomAdvanceAmount: (v: string) => void,
  setMethod: (v: string) => void,
  setTransactionRef: (v: string) => void,
  setPaidAt: (v: string) => void,
  setProofFile: (v: File | null) => void,
) {
  setAdvanceAllocation("");
  setAdvanceDecision("pending");
  setCustomAdvanceAmount("");
  setMethod("");
  setTransactionRef("");
  setPaidAt("");
  setProofFile(null);
}

export type InvoiceSettlementPanelHandle = {
  requestSubmit: () => void;
  submitting: boolean;
  confirmLabel: string;
  canSubmit: boolean;
};

export const InvoiceSettlementPanel = React.forwardRef<
  InvoiceSettlementPanelHandle,
  {
    detail: InvoicePaymentDetail | null;
    loading?: boolean;
    onDetailReload: (invoiceId: string) => Promise<InvoicePaymentDetail | null>;
    onSuccess: () => void;
    onSettled?: () => void;
    resetKey?: string;
    onActionStateChange?: (state: {
      submitting: boolean;
      confirmLabel: string;
      canSubmit: boolean;
    }) => void;
  }
>(function InvoiceSettlementPanel(
  { detail, loading, onDetailReload, onSuccess, onSettled, resetKey, onActionStateChange },
  ref,
) {
  const [submitting, setSubmitting] = React.useState(false);
  const [advanceAllocation, setAdvanceAllocation] = React.useState("");
  const [advanceDecision, setAdvanceDecision] =
    React.useState<AdvanceCreditDecision>("pending");
  const [customAdvanceAmount, setCustomAdvanceAmount] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [transactionRef, setTransactionRef] = React.useState("");
  const [paidAt, setPaidAt] = React.useState("");
  const [proofFile, setProofFile] = React.useState<File | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const paymentGated =
    detail?.matchStatus === InvoiceMatchStatus.MISMATCH && !detail.overrideReason;

  const remaining = Number(detail?.remaining ?? 0);
  const advanceUnallocated = Number(detail?.advanceUnallocatedOnPo ?? 0);
  const maxApplicable = maxAdvanceApplicable(advanceUnallocated, remaining);
  const allocNum = Number(advanceAllocation) || 0;
  const cashDue = deriveCashDue(remaining, allocNum);
  const needsAdvancePrompt =
    detail != null &&
    remaining > 0 &&
    maxApplicable > 0 &&
    advanceDecision === "pending";

  const canShowSettlementForm =
    detail != null &&
    remaining > 0 &&
    !paymentGated &&
    (maxApplicable <= 0 || advanceDecision !== "pending");

  React.useEffect(() => {
    if (!detail) {
      return;
    }
    resetSettlementForm(
      setAdvanceAllocation,
      setAdvanceDecision,
      setCustomAdvanceAmount,
      setMethod,
      setTransactionRef,
      setPaidAt,
      setProofFile,
    );
    if (
      maxAdvanceApplicable(Number(detail.advanceUnallocatedOnPo), Number(detail.remaining)) <= 0
    ) {
      setAdvanceDecision("skip");
      setAdvanceAllocation("0");
    }
  }, [resetKey, detail?.invoiceId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || paymentGated) {
      return;
    }

    const alloc = Number(advanceAllocation) || 0;
    const cash = cashDue;

    if (cash <= 0 && alloc <= 0) {
      toast.error("Choose how much advance credit to apply or enter a cash payment.");
      return;
    }
    if (alloc > maxApplicable + 0.001) {
      toast.error("Advance allocation exceeds available credit or remaining balance.");
      return;
    }
    if (cash > 0 && !method) {
      toast.error("Select a payment method.");
      return;
    }
    if (cash > 0 && !transactionRef.trim()) {
      toast.error("Enter a transaction reference.");
      return;
    }
    if (cash > 0 && !paidAt) {
      toast.error("Enter a paid date.");
      return;
    }

    const fd = new FormData();
    fd.set("invoiceId", detail.invoiceId);
    fd.set("amount", cash > 0 ? String(cash) : "0");
    fd.set("advanceAllocation", String(alloc));
    fd.set("method", method);
    fd.set("transactionRef", transactionRef);
    fd.set("paidAt", paidAt);
    if (proofFile) {
      fd.set("proof", proofFile);
    }

    setSubmitting(true);
    const res = await recordPayment(fd);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.message ?? "Failed to record settlement.");
      return;
    }
    toast.success("Settlement recorded.");
    const updated = await onDetailReload(detail.invoiceId);
    onSuccess();
    if (updated?.paymentStatus === PaymentStatus.PAID) {
      onSettled?.();
    } else if (updated) {
      resetSettlementForm(
        setAdvanceAllocation,
        setAdvanceDecision,
        setCustomAdvanceAmount,
        setMethod,
        setTransactionRef,
        setPaidAt,
        setProofFile,
      );
      const nextMax = maxAdvanceApplicable(
        Number(updated.advanceUnallocatedOnPo),
        Number(updated.remaining),
      );
      if (nextMax <= 0) {
        setAdvanceDecision("skip");
        setAdvanceAllocation("0");
      }
    }
  }

  const confirmLabel =
    detail && remaining > 0
      ? confirmSettlementLabel(allocNum, cashDue)
      : "Confirm settlement";

  const canSubmit = !submitting && !paymentGated && !needsAdvancePrompt && remaining > 0;

  React.useImperativeHandle(ref, () => ({
    requestSubmit: () => formRef.current?.requestSubmit(),
    submitting,
    confirmLabel,
    canSubmit,
  }));

  React.useEffect(() => {
    onActionStateChange?.({ submitting, confirmLabel, canSubmit });
  }, [submitting, confirmLabel, canSubmit, onActionStateChange]);

  if (loading) {
    return <p className="text-ds-sm text-muted-foreground">Loading…</p>;
  }

  if (!detail) {
    return null;
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => void handleSave(e)}
      className="space-y-5"
    >
      {paymentGated ? (
        <div className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-ds-sm text-[var(--status-error)]">
          Settlement is gated — invoice has a match mismatch. An Ops Head override is
          required before you can settle this invoice.
        </div>
      ) : null}

      <SheetSection
        title="Invoice details"
        description="Read-only audit context for this invoice."
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm">
          <DetailRow label="Purchase order">
            <ProcurementRefLink id={detail.poId} className="font-medium" />
          </DetailRow>
          <DetailRow label="Invoice date">{formatDateMedium(detail.invoiceDate)}</DetailRow>
          <DetailRow label="Uploaded by">{detail.uploadedByName}</DetailRow>
          <DetailRow label="Uploaded on">{formatDateMedium(detail.createdAt)}</DetailRow>
          <DetailRow label="Amount">
            <span className="font-semibold tabular-nums">{formatInr(detail.amount)}</span>
          </DetailRow>
          <DetailRow label="Expected">
            {detail.expectedAmount ? (
              <span className="font-semibold tabular-nums">
                {formatInr(detail.expectedAmount)}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailRow>
          {detail.variance != null ? (
            <DetailRow label="Variance" wide>
              <span
                className={
                  detail.variance === 0 ? "text-status-success" : "text-status-warning"
                }
              >
                {formatInr(String(detail.variance))}
                {detail.variancePct != null ? ` (${detail.variancePct.toFixed(1)}%)` : ""}
              </span>
            </DetailRow>
          ) : null}
          {detail.overrideReason ? (
            <DetailRow label="Override reason" wide>
              <span className="text-ds-xs text-muted-foreground">{detail.overrideReason}</span>
            </DetailRow>
          ) : null}
        </dl>
        {detail.grns.length > 0 ? (
          <div className="mt-3 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm">
            <p className="mb-2 text-ds-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Linked goods receipts ({detail.grns.length})
            </p>
            <ul className="space-y-1.5">
              {detail.grns.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3">
                  <span>{formatDateMedium(g.receivedAt)}</span>
                  <span className="text-ds-xs text-muted-foreground">
                    {g.acceptedQty} accepted
                    {g.disputedQty > 0 ? ` · ${g.disputedQty} disputed` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {detail.fileSignedUrl ? (
          <a
            href={detail.fileSignedUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-ds-xs text-primary hover:underline"
          >
            <FileText className="size-3.5" strokeWidth={1.5} aria-hidden />
            View invoice file
          </a>
        ) : null}
      </SheetSection>

      <section className="flex items-start gap-4 rounded-xl border border-border-subtle bg-card p-4 text-ds-sm">
        <ProgressRing
          value={Number(detail.paidTotal)}
          total={Number(detail.amount)}
          size={64}
          strokeWidth={6}
          tone={
            Number(detail.remaining) === 0
              ? "success"
              : detail.paymentStatus === PaymentStatus.PARTIALLY_PAID
                ? "warning"
                : "accent"
          }
          label={
            <span className="text-ds-2xs font-semibold">
              {Number(detail.amount) > 0
                ? `${Math.round((Number(detail.paidTotal) / Number(detail.amount)) * 100)}%`
                : "0%"}
            </span>
          }
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-foreground">Settlement progress</p>
          <p>
            <span className="text-muted-foreground">Settled:</span>{" "}
            <span className="font-semibold tabular-nums text-[var(--status-success)]">
              {formatInr(detail.paidTotal)}
            </span>
            <span className="text-ds-xs text-muted-foreground">
              {" "}
              of {formatInr(detail.amount)}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Remaining:</span>{" "}
            <span className="font-semibold tabular-nums text-[var(--status-warning)]">
              {formatInr(detail.remaining)}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <StatusBadge kind="InvoiceMatchStatus" status={detail.matchStatus} />
            <StatusBadge kind="PaymentStatus" status={detail.paymentStatus} />
            {detail.expectedAmount &&
            Number(detail.amount) !== Number(detail.expectedAmount) ? (
              <Chip tone="warning" size="sm">
                Expected {formatInr(detail.expectedAmount)}
              </Chip>
            ) : null}
          </div>
        </div>
      </section>

      <SettlementHistory
        payments={detail.payments}
        advanceAllocations={detail.advanceAllocations}
      />

      {remaining > 0 ? (
        <>
          <AdvanceCreditPrompt
            poId={detail.poId}
            remaining={remaining}
            advanceUnallocatedOnPo={advanceUnallocated}
            decision={advanceDecision}
            customAmount={customAdvanceAmount}
            advanceAllocation={advanceAllocation}
            disabled={paymentGated}
            pendingAdvanceRequestTotal={Number(detail.pendingAdvanceRequestTotal)}
            firstPendingAdvanceRequestId={detail.firstPendingAdvanceRequestId}
            onApplyMax={() => {
              setAdvanceDecision("apply_max");
              setAdvanceAllocation(String(maxApplicable));
            }}
            onSkip={() => {
              setAdvanceDecision("skip");
              setAdvanceAllocation("0");
            }}
            onStartCustom={() => setAdvanceDecision("custom")}
            onCustomAmountChange={setCustomAdvanceAmount}
            onConfirmCustom={() => {
              const n = Number(customAdvanceAmount) || 0;
              if (n <= 0 || n > maxApplicable + 0.001) {
                toast.error(`Enter an amount between 0 and ${maxApplicable.toFixed(2)}.`);
                return;
              }
              setAdvanceDecision("custom_applied");
              setAdvanceAllocation(String(n));
            }}
            onChangeDecision={() => {
              setAdvanceDecision("pending");
              setAdvanceAllocation("");
              setCustomAdvanceAmount("");
            }}
          />

          {canShowSettlementForm ? (
            <>
              <SettlementBreakdown
                invoiceAmount={Number(detail.amount)}
                cashPaidOnInvoice={Number(detail.cashPaidOnInvoice)}
                advanceAllocatedOnInvoice={Number(detail.advanceAllocated)}
                remaining={remaining}
                advanceUnallocatedOnPo={advanceUnallocated}
                advanceAllocation={allocNum}
              />

              {cashDue > 0 ? (
                <>
                  <VendorBankDetailsCard
                    vendorName={detail.vendorName}
                    bank={detail.vendorBank}
                    transferAmount={cashDue}
                    description="Use these vendor bank details when initiating the cash portion of this settlement. Confirm they match the invoice."
                  />
                  <CashTransferFields
                    method={method}
                    transactionRef={transactionRef}
                    paidAt={paidAt}
                    proofFile={proofFile}
                    disabled={paymentGated}
                    onMethodChange={setMethod}
                    onTransactionRefChange={setTransactionRef}
                    onPaidAtChange={setPaidAt}
                    onProofFileChange={setProofFile}
                  />
                </>
              ) : (
                <div className="rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-ds-sm text-muted-foreground">
                  This settlement uses advance credit only — no bank transfer details
                  required.
                </div>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </form>
  );
});
