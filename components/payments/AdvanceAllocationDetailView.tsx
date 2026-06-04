"use client";

import Link from "next/link";

import { DetailPageShell, DetailSideCard } from "@/components/shared/DetailPageShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { financePaymentRegisterDetailBreadcrumbs } from "@/lib/lineage";
import type { AdvanceAllocationDetail } from "@/lib/queries/payments";
import { cn } from "@/lib/utils";

export function AdvanceAllocationDetailView({
  detail,
}: {
  detail: AdvanceAllocationDetail;
}) {
  return (
    <DetailPageShell
      hero={
        <PageHeader
          breadcrumbs={financePaymentRegisterDetailBreadcrumbs(
            `Advance · ${detail.id.slice(-8).toUpperCase()}`,
          )}
          title={formatInr(detail.amount)}
          subtitle={`Advance credit applied · ${detail.vendorName}`}
          action={
            <Link
              href={FINANCE_ROUTES.paymentRegister}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Back to register
            </Link>
          }
        />
      }
      side={
        <>
          <DetailSideCard title="Invoice">
            <p>
              <Link
                href={FINANCE_ROUTES.invoiceDetail(detail.invoice.id)}
                className="font-medium text-primary hover:underline"
              >
                {detail.invoice.invoiceNumber}
              </Link>
            </p>
            <p>
              <span className="text-muted-foreground">Amount: </span>
              {formatInr(detail.invoice.amount)}
            </p>
            <p>
              <StatusBadge kind="PaymentStatus" status={detail.invoice.paymentStatus} />
            </p>
            <p>
              <span className="text-muted-foreground">Advance on invoice: </span>
              {formatInr(detail.invoice.advanceAllocatedOnInvoice)}
            </p>
          </DetailSideCard>
          <DetailSideCard title="Purchase order">
            <ProcurementRefLink id={detail.poId} className="font-medium" />
          </DetailSideCard>
          <DetailSideCard title="Source advance payment">
            <p>
              <Link
                href={FINANCE_ROUTES.advancePaymentDetail(detail.advancePayment.id)}
                className="font-medium text-primary hover:underline"
              >
                {formatInr(detail.advancePayment.amount)} disbursement
              </Link>
            </p>
            <p>
              <span className="text-muted-foreground">Paid: </span>
              {formatDateMedium(detail.advancePayment.paidAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Unallocated on PO: </span>
              {formatInr(detail.advancePayment.unallocatedOnPo)}
            </p>
          </DetailSideCard>
        </>
      }
      body={
        <dl className="grid gap-4 rounded-2xl border border-border-subtle bg-card p-5 text-ds-sm shadow-ds sm:grid-cols-2">
          <div>
            <dt className="text-ds-xs text-muted-foreground">Applied amount</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{formatInr(detail.amount)}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Applied on</dt>
            <dd className="mt-0.5">{formatDateMedium(detail.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Advance txn ref</dt>
            <dd className="mt-0.5 font-mono text-ds-xs">
              {detail.advancePayment.transactionRef}
            </dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Paid by</dt>
            <dd className="mt-0.5">{detail.advancePayment.paidByName}</dd>
          </div>
        </dl>
      }
    />
  );
}
