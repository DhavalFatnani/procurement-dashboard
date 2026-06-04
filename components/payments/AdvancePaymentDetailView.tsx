"use client";

import Link from "next/link";

import { Chip } from "@/components/shared/Chip";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DetailPageShell, DetailSideCard } from "@/components/shared/DetailPageShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { buttonVariants } from "@/components/ui/button";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { financeAdvancePaymentDetailBreadcrumbs } from "@/lib/lineage";
import type { AdvancePaymentDetail } from "@/lib/queries/po-advance";
import { cn } from "@/lib/utils";

type AllocationRow = AdvancePaymentDetail["allocations"][number];

export function AdvancePaymentDetailView({
  detail,
}: {
  detail: AdvancePaymentDetail;
}) {
  const allocationColumns: DataTableColumn<AllocationRow>[] = [
    {
      id: "invoice",
      header: "Invoice",
      cell: (r) => (
        <Link
          href={FINANCE_ROUTES.invoiceDetail(r.invoiceId)}
          className="font-medium text-primary hover:underline"
        >
          {r.invoiceNumber}
        </Link>
      ),
    },
    {
      id: "amount",
      header: "Allocated",
      variant: "numeric",
      cell: (r) => formatInr(r.amount),
    },
    {
      id: "date",
      header: "Applied on",
      variant: "date",
      cell: (r) => formatDateMedium(r.createdAt),
    },
    {
      id: "link",
      header: "",
      cell: (r) => (
        <Link
          href={FINANCE_ROUTES.allocationDetail(r.id)}
          className="text-ds-xs text-primary hover:underline"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <DetailPageShell
      defaultSideOpen={false}
      hero={
        <PageHeader
          breadcrumbs={financeAdvancePaymentDetailBreadcrumbs(detail.poLabel)}
          title={formatInr(detail.amount)}
          subtitle={`Vendor advance · ${detail.vendorName}`}
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
          <DetailSideCard title="Credit balance">
            <p>
              <span className="text-muted-foreground">Allocated: </span>
              {formatInr(detail.allocated)}
            </p>
            <p>
              <span className="text-muted-foreground">Unallocated: </span>
              <span className="font-semibold text-[var(--status-warning)]">
                {formatInr(detail.unallocated)}
              </span>
            </p>
          </DetailSideCard>
          <DetailSideCard title="Purchase order">
            <ProcurementRefLink id={detail.poId} className="font-medium" />
          </DetailSideCard>
          <DetailSideCard title="Source request">
            <p>
              <Link
                href={FINANCE_ROUTES.advanceRequestDetail(detail.requestId)}
                className="font-medium text-primary hover:underline"
              >
                View request
              </Link>
            </p>
            <p className="mt-2 text-ds-xs text-muted-foreground">{detail.request.reason}</p>
            <p className="mt-1">
              <Chip tone="neutral" size="sm" variant="soft">
                {detail.request.status.replaceAll("_", " ")}
              </Chip>
            </p>
          </DetailSideCard>
        </>
      }
      body={
        <div className="space-y-6">
          <dl className="grid gap-4 rounded-2xl border border-border-subtle bg-card p-5 text-ds-sm shadow-ds sm:grid-cols-2">
            <div>
              <dt className="text-ds-xs text-muted-foreground">Method</dt>
              <dd className="mt-0.5">{detail.method ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Transaction reference</dt>
              <dd className="mt-0.5 font-mono text-ds-xs">{detail.transactionRef}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Paid date</dt>
              <dd className="mt-0.5">{formatDateMedium(detail.paidAt)}</dd>
            </div>
            <div>
              <dt className="text-ds-xs text-muted-foreground">Paid by</dt>
              <dd className="mt-0.5">{detail.paidByName}</dd>
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

          {detail.allocations.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-ds-sm font-semibold text-foreground">Invoice allocations</h3>
              <DataTable
                columns={allocationColumns}
                data={detail.allocations}
                getRowKey={(r) => r.id}
                scrollMaxHeight={false}
              />
            </div>
          ) : null}
        </div>
      }
    />
  );
}
