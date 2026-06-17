"use client";

import { canManageFinance, isCentralOpsOrAbove } from "@/lib/admin-access";
import { InvoiceMatchStatus, POAdvanceRequestStatus, Role } from "@/lib/prisma-enums";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import {
  cancelAdvanceRequest,
  fetchPOAdvanceSummary,
  rejectAdvanceRequest,
} from "@/app/actions/advance-payments";
import { AdvanceOverageAlert } from "@/components/payments/AdvanceOverageAlert";
import { overrideInvoiceMatch } from "@/app/actions/invoices";
import { DocumentLinks } from "@/components/shared/DocumentLinks";
import { ReconciliationPanel } from "@/components/shared/ReconciliationPanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { TextareaActionDialog } from "@/components/shared/TextareaActionDialog";
import { Button } from "@/components/ui/button";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { formatDateTimeMedium, formatInr } from "@/lib/format-datetime";
import type { POAdvanceSummary } from "@/lib/queries/po-advance";
import type { PODetail, POInvoicePaymentRow } from "@/lib/queries/purchase-orders";
import { useServerMutation } from "@/lib/use-server-mutation";

export function PODetailFinancialsTab({
  po,
  role,
}: {
  po: PODetail;
  role: Role;
}) {
  const { isPending, run } = useServerMutation();
  const isOps = isCentralOpsOrAbove(role);
  const isFinance = canManageFinance(role);
  const [overrideInvoiceId, setOverrideInvoiceId] = React.useState<string | null>(
    null,
  );
  const [rejectAdvanceId, setRejectAdvanceId] = React.useState<string | null>(null);
  const [advanceSummary, setAdvanceSummary] = React.useState<POAdvanceSummary | null>(
    null,
  );
  const [loadingAdvance, setLoadingAdvance] = React.useState(true);

  const reloadAdvance = React.useCallback(async () => {
    setLoadingAdvance(true);
    const summary = await fetchPOAdvanceSummary(po.id);
    setAdvanceSummary(summary);
    setLoadingAdvance(false);
  }, [po.id]);

  React.useEffect(() => {
    void reloadAdvance();
  }, [reloadAdvance]);

  function handleOverrideMatch(reason: string) {
    if (!overrideInvoiceId) return;
    const invoiceId = overrideInvoiceId;
    void run(() => overrideInvoiceMatch(invoiceId, reason), {
      onSuccess: () => {
        toast.success("Invoice match overridden.");
        setOverrideInvoiceId(null);
      },
      onError: (m) => toast.error(m),
    });
  }

  function handleCancelAdvance(requestId: string) {
    void run(() => cancelAdvanceRequest(requestId), {
      onSuccess: () => {
        toast.success("Advance request cancelled.");
        void reloadAdvance();
      },
      onError: (m) => toast.error(m),
    });
  }

  function handleRejectAdvance(reason: string) {
    if (!rejectAdvanceId) return;
    const requestId = rejectAdvanceId;
    void run(() => rejectAdvanceRequest(requestId, reason), {
      onSuccess: () => {
        toast.success("Advance request rejected.");
        setRejectAdvanceId(null);
        void reloadAdvance();
      },
      onError: (m) => toast.error(m),
    });
  }

  const showAdvanceCard =
    loadingAdvance ||
    (advanceSummary != null &&
      (Number(advanceSummary.advancePaid) > 0 ||
        advanceSummary.requests.length > 0));

  return (
    <div className="section-stack">
      <ReconciliationPanel
        metrics={{
          ordered: po.reconciliation.ordered,
          received: po.reconciliation.received,
          invoiced: po.reconciliation.invoiced,
          advanced: po.reconciliation.advanced,
          settled: po.reconciliation.settled,
          paid: po.reconciliation.paid,
        }}
        closureChecks={po.reconciliation.checks}
      />

      {showAdvanceCard ? (
        <SurfaceCard
          header={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <SurfaceCardTitle>Advance payments</SurfaceCardTitle>
                <SurfaceCardDescription>
                  Ops requests at PO setup; Finance fulfills; credit applies at invoice
                  payment.
                </SurfaceCardDescription>
              </div>
              {isFinance && advanceSummary ? (
                <>
                  {advanceSummary.requests.some(
                    (r) => r.status === POAdvanceRequestStatus.PENDING,
                  ) ? (
                    <Button
                      size="sm"
                      variant="soft"
                      render={
                        <Link
                          href={`${FINANCE_ROUTES.vendorAdvances}?advanceRequestId=${encodeURIComponent(
                            advanceSummary.requests.find(
                              (r) => r.status === POAdvanceRequestStatus.PENDING,
                            )!.id,
                          )}`}
                        />
                      }
                    >
                      Pay pending request
                    </Button>
                  ) : Number(advanceSummary.advanceUnallocated) > 0 ? (
                    <Button
                      size="sm"
                      variant="soft"
                      render={<Link href={FINANCE_ROUTES.invoiceSettlement} />}
                    >
                      Settle invoices
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          }
        >
          {loadingAdvance ? (
            <p className="text-ds-sm text-muted-foreground">Loading advance summary…</p>
          ) : advanceSummary ? (
            <div className="space-y-4">
              {advanceSummary.overageWarning ? (
                <AdvanceOverageAlert message={advanceSummary.overageWarning} />
              ) : null}
              <dl className="grid gap-3 text-ds-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Committed PO</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatInr(advanceSummary.committedTotal)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Advance paid</dt>
                  <dd className="font-semibold tabular-nums text-[var(--status-info)]">
                    {formatInr(advanceSummary.advancePaid)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Allocated to invoices</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatInr(advanceSummary.advanceAllocated)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Unallocated credit</dt>
                  <dd className="font-semibold tabular-nums text-[var(--status-warning)]">
                    {formatInr(advanceSummary.advanceUnallocated)}
                  </dd>
                </div>
              </dl>
              {advanceSummary.requests.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-ds-sm">
                    <thead>
                      <tr className="border-b border-border-subtle text-left text-ds-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Amount</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Reason</th>
                        <th className="py-2 pr-4 font-medium">Requested</th>
                        <th className="py-2 pr-4 font-medium">Proof</th>
                        {isOps || isFinance ? (
                          <th className="py-2 pr-4 font-medium text-right">Actions</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {advanceSummary.requests.map((req) => (
                        <tr
                          key={req.id}
                          className="border-b border-border-subtle last:border-0"
                        >
                          <td className="py-3 pr-4 tabular-nums font-medium">
                            {formatInr(req.requestedAmount)}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge
                              kind="POAdvanceRequestStatus"
                              status={req.status}
                            />
                          </td>
                          <td className="py-3 pr-4 max-w-[240px] text-muted-foreground">
                            {req.reason}
                          </td>
                          <td className="py-3 pr-4 text-ds-xs text-muted-foreground">
                            <span className="block text-foreground">
                              {req.requestedByName}
                            </span>
                            {formatDateTimeMedium(req.requestedAt)}
                            {req.paidAt ? (
                              <>
                                <span className="mt-1 block text-foreground">
                                  Paid {formatDateTimeMedium(req.paidAt)}
                                  {req.paidByName ? ` · ${req.paidByName}` : ""}
                                </span>
                                {req.method || req.transactionRef ? (
                                  <span className="block">
                                    {[req.method, req.transactionRef ? `Txn ${req.transactionRef}` : null]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                ) : null}
                              </>
                            ) : null}
                          </td>
                          <td className="py-3 pr-4">
                            {req.proofSignedUrl ? (
                              <DocumentLinks
                                url={req.proofSignedUrl}
                                filename={`advance-proof-${req.paymentId ?? req.id}.pdf`}
                                size="xs"
                                showLabel
                                label="Proof"
                              />
                            ) : req.paidAt ? (
                              <span className="text-ds-xs text-muted-foreground">No file</span>
                            ) : (
                              <span className="text-ds-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          {isOps || isFinance ? (
                            <td className="py-3 pr-4 text-right">
                              {req.status === POAdvanceRequestStatus.PENDING &&
                              isOps ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() => handleCancelAdvance(req.id)}
                                >
                                  Cancel
                                </Button>
                              ) : null}
                              {req.status === POAdvanceRequestStatus.PENDING &&
                              isFinance ? (
                                <span className="inline-flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isPending}
                                    onClick={() => setRejectAdvanceId(req.id)}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    render={
                                      <Link
                                        href={`${FINANCE_ROUTES.vendorAdvances}?advanceRequestId=${encodeURIComponent(req.id)}`}
                                      />
                                    }
                                  >
                                    Pay
                                  </Button>
                                </span>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-ds-sm text-muted-foreground">
                  No advance requests on this PO.
                </p>
              )}
            </div>
          ) : null}
        </SurfaceCard>
      ) : null}

      <SurfaceCard
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <SurfaceCardTitle>Invoices</SurfaceCardTitle>
              <SurfaceCardDescription>
                {po.invoices.length === 0
                  ? "No invoices linked yet."
                  : `${po.invoices.length} invoice${po.invoices.length === 1 ? "" : "s"} on file.`}
              </SurfaceCardDescription>
            </div>
            {role === Role.SM || isCentralOpsOrAbove(role) ? (
              <Button
                size="sm"
                variant="soft"
                render={
                  <Link href={`/invoices/new?poId=${encodeURIComponent(po.id)}`} />
                }
              >
                Upload invoice
              </Button>
            ) : null}
          </div>
        }
      >
        {po.invoices.length === 0 ? (
          <p className="py-2 text-ds-sm text-muted-foreground">
            Once invoices are uploaded against this PO they will appear here with match
            + payment status.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-ds-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-ds-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Invoice</th>
                  <th className="py-2 pr-4 font-medium">GRNs</th>
                  <th className="py-2 pr-4 font-medium text-right">Amount</th>
                  <th className="py-2 pr-4 font-medium text-right">Expected</th>
                  <th className="py-2 pr-4 font-medium">Match</th>
                  <th className="py-2 pr-4 font-medium">Payment</th>
                  <th className="py-2 pr-4 font-medium">Proof</th>
                  <th className="py-2 pr-4 font-medium">Uploaded</th>
                  {isOps ? <th className="py-2 pr-4 font-medium" /> : null}
                </tr>
              </thead>
              <tbody>
                {po.invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">{inv.invoiceNumber}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {inv.grnIds.length
                        ? `${inv.grnIds.length} linked receipt(s)`
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {formatInr(inv.amount)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {inv.expectedAmount ? formatInr(inv.expectedAmount) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        kind="InvoiceMatchStatus"
                        status={inv.matchStatus}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge kind="PaymentStatus" status={inv.paymentStatus} />
                    </td>
                    <td className="py-3 pr-4">
                      <InvoicePaymentProofs payments={inv.payments} />
                    </td>
                    <td className="py-3 pr-4 text-ds-xs text-muted-foreground">
                      <span className="block text-foreground">{inv.uploadedByName}</span>
                      {formatDateTimeMedium(inv.createdAt)}
                    </td>
                    {isOps ? (
                      <td className="py-3 pr-4 text-right">
                        {inv.matchStatus === InvoiceMatchStatus.MISMATCH ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOverrideInvoiceId(inv.id)}
                          >
                            Override match
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      <TextareaActionDialog
        open={overrideInvoiceId != null}
        onOpenChange={(open) => {
          if (!open) setOverrideInvoiceId(null);
        }}
        title="Override invoice match"
        description="Accept a mismatched invoice with a documented reason."
        label="Override reason"
        confirmLabel="Override"
        onConfirm={(reason) => void handleOverrideMatch(reason)}
      />

      <TextareaActionDialog
        open={rejectAdvanceId != null}
        onOpenChange={(open) => {
          if (!open) setRejectAdvanceId(null);
        }}
        title="Reject advance request"
        description="Finance declines this advance; Ops can request again after adjusting the PO if needed."
        label="Rejection reason"
        confirmLabel="Reject"
        pending={isPending}
        onConfirm={(reason) => void handleRejectAdvance(reason)}
      />
    </div>
  );
}

function InvoicePaymentProofs({ payments }: { payments: POInvoicePaymentRow[] }) {
  const withProof = payments.filter((payment) => payment.proofSignedUrl);
  if (withProof.length === 0) {
    const hasCash = payments.some((payment) => Number(payment.amount) > 0);
    return (
      <span className="text-ds-xs text-muted-foreground">
        {hasCash ? "No file" : "—"}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {withProof.map((payment) => (
        <div key={payment.id} className="flex flex-wrap items-center gap-2">
          <span className="text-ds-xs tabular-nums text-muted-foreground">
            {formatInr(payment.amount)}
          </span>
          <DocumentLinks
            url={payment.proofSignedUrl}
            filename={`invoice-payment-proof-${payment.id}.pdf`}
            size="xs"
          />
        </div>
      ))}
    </div>
  );
}
