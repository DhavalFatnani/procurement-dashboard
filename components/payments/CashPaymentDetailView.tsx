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
import type { CashPaymentDetail } from "@/lib/queries/payments";
import { cn } from "@/lib/utils";

export function CashPaymentDetailView({ detail }: { detail: CashPaymentDetail }) {
  return (
    <DetailPageShell
      hero={
        <PageHeader
          breadcrumbs={financePaymentRegisterDetailBreadcrumbs(
            detail.transactionRef ?? detail.id.slice(-8).toUpperCase(),
          )}
          title={formatInr(detail.amount)}
          subtitle={`Cash payment · ${detail.vendorName}`}
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
              <span className="text-muted-foreground">Remaining: </span>
              {formatInr(detail.invoice.remaining)}
            </p>
          </DetailSideCard>
          <DetailSideCard title="Purchase order">
            <ProcurementRefLink id={detail.poId} className="font-medium" />
          </DetailSideCard>
        </>
      }
      body={
        <dl className="grid gap-4 rounded-2xl border border-border-subtle bg-card p-5 text-ds-sm shadow-ds sm:grid-cols-2">
          <div>
            <dt className="text-ds-xs text-muted-foreground">Method</dt>
            <dd className="mt-0.5 font-medium">{detail.method ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Transaction reference</dt>
            <dd className="mt-0.5 font-mono text-ds-xs">{detail.transactionRef ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Paid date</dt>
            <dd className="mt-0.5">{formatDateMedium(detail.paidAt)}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Recorded by</dt>
            <dd className="mt-0.5">{detail.paidByName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Recorded on</dt>
            <dd className="mt-0.5">{formatDateMedium(detail.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-ds-xs text-muted-foreground">Status</dt>
            <dd className="mt-0.5">
              <StatusBadge kind="PaymentStatus" status={detail.status} />
            </dd>
          </div>
          {detail.proofSignedUrl ? (
            <div className="sm:col-span-2">
              <dt className="text-ds-xs text-muted-foreground">Proof</dt>
              <dd className="mt-0.5">
                <a
                  href={detail.proofSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  View payment proof
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      }
    />
  );
}
