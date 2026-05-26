"use client";

import { InvoiceMatchStatus, Role } from "@prisma/client";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { useServerMutation } from "@/lib/use-server-mutation";

import { overrideInvoiceMatch } from "@/app/actions/invoices";
import { ReconciliationPanel } from "@/components/shared/ReconciliationPanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { TextareaActionDialog } from "@/components/shared/TextareaActionDialog";
import { Button } from "@/components/ui/button";
import { formatDateTimeMedium, formatInr } from "@/lib/format-datetime";
import type { PODetail } from "@/lib/queries/purchase-orders";

export function PODetailFinancialsTab({
  po,
  role,
}: {
  po: PODetail;
  role: Role;
}) {
  const { isPending, run } = useServerMutation();
  const isOps = role === Role.OPS_HEAD;
  const [overrideInvoiceId, setOverrideInvoiceId] = React.useState<
    string | null
  >(null);

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

  return (
    <div className="section-stack">
      <ReconciliationPanel
        metrics={{
          ordered: po.reconciliation.ordered,
          received: po.reconciliation.received,
          invoiced: po.reconciliation.invoiced,
          paid: po.reconciliation.paid,
        }}
        closureChecks={po.reconciliation.checks}
      />

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
            {(role === Role.SM || role === Role.OPS_HEAD) ? (
              <Button
                size="sm"
                variant="soft"
                render={
                  <Link
                    href={`/invoices/new?poId=${encodeURIComponent(po.id)}`}
                  />
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
            Once invoices are uploaded against this PO they will appear here
            with match + payment status.
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
                    <td className="py-3 pr-4 font-medium">
                      {inv.invoiceNumber}
                    </td>
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
                      <StatusBadge
                        kind="PaymentStatus"
                        status={inv.paymentStatus}
                      />
                    </td>
                    <td className="py-3 pr-4 text-ds-xs text-muted-foreground">
                      <span className="block text-foreground">
                        {inv.uploadedByName}
                      </span>
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
    </div>
  );
}
