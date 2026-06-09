"use client";

import { isOpsHeadOrAdmin } from "@/lib/admin-access";
import { Role, VendorStatus } from "@/lib/prisma-enums";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  deactivateVendor,
  mergeVendors,
  reactivateVendor,
} from "@/app/actions/vendors";
import type { VendorDetail } from "@/lib/queries/vendors";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, getRowId, type DataTableColumn } from "@/components/shared/DataTable";
import { DetailPageShell, DetailSideCard } from "@/components/shared/DetailPageShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EditVendorSheet } from "@/components/vendors/EditVendorSheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

type PoRow = VendorDetail["purchaseOrders"]["items"][number];

export function VendorDetailView({
  vendor,
  role,
}: {
  vendor: VendorDetail;
  role: Role;
}) {
  const pos = vendor.purchaseOrders;
  const router = useRouter();
  const canManage = isOpsHeadOrAdmin(role);
  const [tab, setTab] = React.useState<"history" | "pos">(canManage ? "history" : "pos");
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const handlePoRowClick = React.useCallback(
    (r: PoRow) => router.push(`/purchase-orders/${r.id}`),
    [router],
  );

  const poColumns: DataTableColumn<PoRow>[] = React.useMemo(
    () => [
      {
        id: "id",
        header: "Reference",
        cell: (r) => <ProcurementRefLink id={r.id} />,
      },
      {
        id: "status",
        header: "Status",
        cell: (r) => <StatusBadge kind="POStatus" status={r.status} />,
      },
      { id: "created", header: "Created", cell: (r) => formatDateTimeMedium(r.createdAt) },
      {
        id: "value",
        header: "Total value",
        cell: (r) => (r.totalValue ? `₹${r.totalValue}` : "—"),
      },
    ],
    [],
  );

  const historyColumns: DataTableColumn<VendorDetail["changeLogs"][number]>[] = React.useMemo(
    () => [
      { id: "field", header: "Field", cell: (r) => r.fieldName },
      { id: "old", header: "Old", cell: (r) => r.oldValue ?? "—" },
      { id: "new", header: "New", cell: (r) => r.newValue ?? "—" },
      { id: "by", header: "Changed by", cell: (r) => r.changedByName },
      { id: "at", header: "Date", cell: (r) => formatDateTimeMedium(r.changedAt) },
      { id: "reason", header: "Reason", cell: (r) => r.reason ?? "—" },
    ],
    [],
  );

  return (
    <>
      {vendor.hasSimilarVendorFlag && vendor.similarVendorName && vendor.similarVendorId ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-950 dark:text-amber-100">
            Similar vendor exists: <strong>{vendor.similarVendorName}</strong>. Review or merge.
          </p>
          {canManage ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
              Merge vendors
            </Button>
          ) : null}
        </div>
      ) : null}

      <DetailPageShell
        hero={
          <PageHeader
            title={vendor.businessName}
            subtitle={`POC: ${vendor.pocName} · ${vendor.phone}`}
            action={
              <div className="flex flex-wrap gap-2">
                <Link href="/vendors" className={cn(buttonVariants({ variant: "outline" }))}>
                  Back to list
                </Link>
                {canManage ? (
                  vendor.status === VendorStatus.ACTIVE ? (
                    <Button type="button" variant="destructive" onClick={() => setDeactivateOpen(true)}>
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="gradient"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const r = await reactivateVendor(vendor.id);
                          if (r.ok) {
                            toast.success("Vendor reactivated.");
                            router.refresh();
                          }
                        });
                      }}
                    >
                      Reactivate
                    </Button>
                  )
                ) : null}
              </div>
            }
          />
        }
        side={
          <>
            <DetailSideCard
              title="Basic info"
              action={canManage ? <EditVendorSheet vendor={vendor} /> : undefined}
            >
              <p>
                <span className="text-muted-foreground">GST: </span>
                {vendor.gst ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Address: </span>
                {vendor.address ?? "—"}
              </p>
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">Status: </span>
                <StatusBadge kind="VendorStatus" status={vendor.status} />
              </p>
            </DetailSideCard>
            <DetailSideCard title="Contact">
              <p>{vendor.pocName}</p>
              <p>{vendor.email}</p>
              <p>{vendor.phone}</p>
            </DetailSideCard>
            <DetailSideCard title="Bank info">
              <p>
                <span className="text-muted-foreground">Account name: </span>
                {vendor.accountName}
              </p>
              <p>
                <span className="text-muted-foreground">Account number: </span>
                <span className="font-mono">••••{vendor.accountLast4}</span>
              </p>
              <p>
                <span className="text-muted-foreground">IFSC: </span>
                {vendor.ifsc}
              </p>
              <p>
                <span className="text-muted-foreground">Bank: </span>
                {vendor.bankName}
              </p>
            </DetailSideCard>
          </>
        }
        body={
          <div className="space-y-3">
            <div className="flex gap-2 border-b border-border-subtle">
          {canManage ? (
            <button
              type="button"
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                tab === "history"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
              onClick={() => setTab("history")}
            >
              Edit history
            </button>
          ) : null}
          <button
            type="button"
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === "pos"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground",
            )}
            onClick={() => setTab("pos")}
          >
            Linked POs
          </button>
        </div>

        {tab === "history" && canManage ? (
          vendor.changeLogs.length === 0 ? (
            <EmptyState title="No edit history" description="Changes will appear here after updates." />
          ) : (
            <DataTable columns={historyColumns} data={vendor.changeLogs} getRowKey={getRowId} />
          )
        ) : null}

        {tab === "pos" ? (
          pos.items.length === 0 ? (
            <EmptyState title="No linked POs" />
          ) : (
            <>
              <DataTable
                columns={poColumns}
                data={pos.items}
                getRowKey={getRowId}
                onRowClick={handlePoRowClick}
              />
              <Pagination
                basePath={`/vendors/${vendor.id}`}
                page={pos.page}
                pageSize={pos.pageSize}
                total={pos.total}
                totalPages={pos.totalPages}
                pageParam="poPage"
                searchParams={{}}
              />
            </>
          )
        ) : null}
            <p className="text-ds-xs text-muted-foreground">
              Created by {vendor.createdByName} on {formatDateTimeMedium(vendor.createdAt)}.
            </p>
          </div>
        }
      />

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={`Deactivate ${vendor.businessName}?`}
        description="This prevents future purchases but keeps all history intact."
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        onConfirm={() => {
          startTransition(async () => {
            const r = await deactivateVendor(vendor.id);
            if (r.ok) {
              toast.success("Vendor deactivated.");
              router.refresh();
            }
          });
        }}
      />

      {vendor.similarVendorId ? (
        <ConfirmDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          title="Merge vendors"
          description={`Merge ${vendor.similarVendorName} into ${vendor.businessName}? All purchase orders from ${vendor.similarVendorName} will be re-linked to ${vendor.businessName}. ${vendor.similarVendorName} will be deactivated.`}
          confirmLabel="Merge"
          confirmVariant="destructive"
          onConfirm={() => {
            startTransition(async () => {
              const r = await mergeVendors(vendor.id, vendor.similarVendorId!);
              if (r.ok) {
                toast.success("Vendors merged.");
                router.refresh();
              } else {
                toast.error(r.message ?? "Merge failed.");
              }
            });
          }}
        />
      ) : null}
    </>
  );
}
