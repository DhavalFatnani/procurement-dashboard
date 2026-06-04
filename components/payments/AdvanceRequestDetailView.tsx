"use client";

import { POAdvanceRequestStatus } from "@/lib/prisma-enums";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { recordAdvancePayment, rejectAdvanceRequest } from "@/app/actions/advance-payments";
import { AdvanceOverageAlert } from "@/components/payments/AdvanceOverageAlert";
import { VendorBankDetailsCard } from "@/components/payments/VendorBankDetailsCard";
import { Chip } from "@/components/shared/Chip";
import { DetailPageShell, DetailSideCard } from "@/components/shared/DetailPageShell";
import { Field } from "@/components/shared/Field";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { SheetSection } from "@/components/shared/SheetSection";
import { TextareaActionDialog } from "@/components/shared/TextareaActionDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { financeAdvanceRequestDetailBreadcrumbs } from "@/lib/lineage";
import type { AdvanceRequestDetailPage } from "@/lib/queries/po-advance";
import { cn } from "@/lib/utils";

const PAYMENT_METHOD_OPTIONS = [
  { value: "NEFT", label: "NEFT" },
  { value: "RTGS", label: "RTGS" },
  { value: "IMPS", label: "IMPS" },
  { value: "UPI", label: "UPI" },
  { value: "Cheque", label: "Cheque" },
  { value: "Other", label: "Other" },
] as const;

function statusTone(
  status: POAdvanceRequestStatus,
): "warning" | "success" | "neutral" | "error" {
  switch (status) {
    case POAdvanceRequestStatus.PENDING:
      return "warning";
    case POAdvanceRequestStatus.FULFILLED:
      return "success";
    case POAdvanceRequestStatus.CANCELLED:
    case POAdvanceRequestStatus.REJECTED:
      return "neutral";
    default:
      return "neutral";
  }
}

export function AdvanceRequestDetailView({
  detail,
}: {
  detail: AdvanceRequestDetailPage;
}) {
  const router = useRouter();
  const isPending = detail.status === POAdvanceRequestStatus.PENDING;
  const [submitting, setSubmitting] = React.useState(false);
  const [method, setMethod] = React.useState("");
  const [transactionRef, setTransactionRef] = React.useState("");
  const [paidAt, setPaidAt] = React.useState("");
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);

  const advanceAllocatedOnPo = Math.max(
    0,
    Number(detail.advancePaid) - Number(detail.advanceUnallocated),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPending) return;
    if (!method) {
      toast.error("Select a payment method.");
      return;
    }
    const fd = new FormData();
    fd.set("requestId", detail.id);
    fd.set("method", method);
    fd.set("transactionRef", transactionRef);
    fd.set("paidAt", paidAt);
    if (proofFile) fd.set("proof", proofFile);

    setSubmitting(true);
    const res = await recordAdvancePayment(fd);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.message ?? "Failed to record advance payment.");
      return;
    }
    toast.success("Advance payment recorded.");
    router.push(FINANCE_ROUTES.vendorAdvances);
    router.refresh();
  }

  function handleReject(reason: string) {
    void (async () => {
      setSubmitting(true);
      const res = await rejectAdvanceRequest(detail.id, reason);
      setSubmitting(false);
      if (!res.ok) {
        toast.error(res.message ?? "Failed to reject advance request.");
        return;
      }
      toast.success("Advance request rejected.");
      setRejectOpen(false);
      router.push(FINANCE_ROUTES.vendorAdvances);
      router.refresh();
    })();
  }

  return (
    <>
      <DetailPageShell
        hero={
          <PageHeader
            breadcrumbs={financeAdvanceRequestDetailBreadcrumbs(detail.poId)}
            title={formatInr(detail.requestedAmount)}
            subtitle={`Advance request · ${detail.vendorName}`}
            action={
              <Link
                href={FINANCE_ROUTES.vendorAdvances}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Back to list
              </Link>
            }
          />
        }
        side={
          <>
            <DetailSideCard title="Status">
              <Chip tone={statusTone(detail.status)} size="sm" variant="soft">
                {detail.status.replaceAll("_", " ")}
              </Chip>
            </DetailSideCard>
            <DetailSideCard title="Purchase order">
              <ProcurementRefLink id={detail.poId} className="font-medium" />
              <p className="mt-2">
                <span className="text-muted-foreground">Committed: </span>
                {formatInr(detail.committedTotal)}
              </p>
            </DetailSideCard>
            <DetailSideCard title="PO advance wallet">
              <p>
                <span className="text-muted-foreground">Paid: </span>
                {formatInr(detail.advancePaid)}
              </p>
              <p>
                <span className="text-muted-foreground">Allocated: </span>
                {formatInr(advanceAllocatedOnPo)}
              </p>
              <p>
                <span className="text-muted-foreground">Unallocated: </span>
                {formatInr(detail.advanceUnallocated)}
              </p>
            </DetailSideCard>
            <DetailSideCard title="Requested by">
              <p>{detail.requestedByName}</p>
              <p className="text-ds-xs text-muted-foreground">
                {formatDateMedium(detail.requestedAt)}
              </p>
            </DetailSideCard>
            {detail.payment ? (
              <DetailSideCard title="Payment recorded">
                <p>
                  <Link
                    href={FINANCE_ROUTES.advancePaymentDetail(detail.payment.id)}
                    className="font-medium text-primary hover:underline"
                  >
                    {formatInr(detail.payment.amount)}
                  </Link>
                </p>
                <p className="text-ds-xs text-muted-foreground">
                  {detail.payment.method} · {formatDateMedium(detail.payment.paidAt)}
                </p>
              </DetailSideCard>
            ) : null}
            {detail.reviewedByName ? (
              <DetailSideCard title="Review">
                <p>{detail.reviewedByName}</p>
                {detail.reviewReason ? (
                  <p className="text-ds-xs text-muted-foreground">{detail.reviewReason}</p>
                ) : null}
              </DetailSideCard>
            ) : null}
          </>
        }
        body={
          <div className="space-y-6">
            {detail.overageWarning ? (
              <AdvanceOverageAlert message={detail.overageWarning} />
            ) : null}

            <div className="rounded-2xl border border-border-subtle bg-card p-5 text-ds-sm shadow-ds">
              <h3 className="text-ds-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Request reason
              </h3>
              <p className="mt-2">{detail.reason}</p>
              {detail.requestedPercent ? (
                <p className="mt-2 text-ds-xs text-muted-foreground">
                  {detail.requestedPercent}% of committed PO value
                </p>
              ) : null}
            </div>

            {isPending ? (
              <form
                onSubmit={(e) => void handleSubmit(e)}
                className="space-y-6 rounded-2xl border border-border-subtle bg-card p-5 shadow-ds"
              >
                <VendorBankDetailsCard
                  vendorName={detail.vendorName}
                  bank={detail.vendorBank}
                  transferAmount={Number(detail.requestedAmount)}
                  description="Pay the vendor advance to this account. Confirm the details match your records before recording payment."
                />

                <SheetSection title="Payment">
                  <p className="mb-3 text-ds-sm">
                    Pay exactly{" "}
                    <span className="font-semibold font-tabular">
                      {formatInr(detail.requestedAmount)}
                    </span>
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Method" htmlFor="adv-method">
                      <Select value={method || undefined} onValueChange={setMethod}>
                        <SelectTrigger id="adv-method" className="h-9">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHOD_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Paid date" htmlFor="adv-paid-at">
                      <Input
                        id="adv-paid-at"
                        type="date"
                        value={paidAt}
                        onChange={(e) => setPaidAt(e.target.value)}
                        required
                      />
                    </Field>
                    <Field
                      label="Transaction reference"
                      htmlFor="adv-txn"
                      className="sm:col-span-2"
                    >
                      <Input
                        id="adv-txn"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        required
                      />
                    </Field>
                    <Field label="Proof (optional)" htmlFor="adv-proof" className="sm:col-span-2">
                      <Input
                        id="adv-proof"
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                      />
                    </Field>
                  </div>
                </SheetSection>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject request
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving…" : "Record advance payment"}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        }
      />

      <TextareaActionDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject advance request"
        description="Ops will see this reason on the PO. The request cannot be paid after rejection."
        label="Rejection reason"
        placeholder="Why Finance is not paying this advance"
        confirmLabel="Reject"
        pending={submitting}
        onConfirm={handleReject}
      />
    </>
  );
}
