"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/EmptyState";
import {
  DataTable,
  getRowId,
  type DataTableColumn,
} from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrPageTitle } from "@/lib/display-ref";
import { formatDateMedium } from "@/lib/format-datetime";
import { listBreadcrumbs } from "@/lib/lineage";
import type { ApprovedPRAwaitingPO } from "@/lib/queries/purchase-orders";
import { cn } from "@/lib/utils";

export function PendingConfigurePOListView({
  rows,
}: {
  rows: ApprovedPRAwaitingPO[];
}) {
  const router = useRouter();

  const columns: DataTableColumn<ApprovedPRAwaitingPO>[] = [
    {
      id: "id",
      header: "Reference",
      cell: (pr) => <ProcurementRefLink id={pr.id} className="font-medium" />,
      variant: "id",
    },
    {
      id: "title",
      header: "Request",
      cell: (pr) =>
        formatPrPageTitle({
          id: pr.id,
          categoryName: pr.categoryName,
          subcategoryName: pr.subcategoryName,
        }),
    },
    {
      id: "quantity",
      header: "Qty",
      cell: (pr) => pr.quantity,
      variant: "numeric",
    },
    {
      id: "warehouse",
      header: "Warehouse",
      cell: (pr) => pr.warehouseName,
    },
    {
      id: "created",
      header: "Submitted",
      cell: (pr) => (
        <span>
          {formatDateMedium(pr.createdAt)}
          <span className="block text-ds-xs text-muted-foreground">{pr.createdByName}</span>
        </span>
      ),
      variant: "date",
    },
    {
      id: "vendorRequest",
      header: "Vendor request",
      cell: (pr) =>
        pr.vendorRequestLabel ? (
          <span className="text-status-warning">{pr.vendorRequestLabel}</span>
        ) : (
          "—"
        ),
    },
    {
      id: "action",
      header: "",
      cell: (pr) => (
        <Button
          render={
            <Link href={`/purchase-orders/configure/${encodeURIComponent(pr.id)}`} />
          }
          variant="outline"
          size="sm"
          nativeButton={false}
        >
          Configure PO
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={listBreadcrumbs("/purchase-orders/configure")}
        title="Configure purchase orders"
        subtitle="Approved vendor requests awaiting PO — select vendor, rates, and expected delivery."
        action={
          <Link href="/purchase-orders" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to PO list
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          variant="default"
          title="No approved requests awaiting PO"
          description="When Ops approves a vendor purchase request, it will appear here for PO creation."
          action={
            <Link
              href="/purchase-requests?status=APPROVED"
              className={cn(buttonVariants({ variant: "gradient" }))}
            >
              View approved PRs
            </Link>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={getRowId}
          onRowClick={(pr) => router.push(`/purchase-orders/configure/${encodeURIComponent(pr.id)}`)}
        />
      )}
    </div>
  );
}
