"use client";

import { ExecutionType, PRStatus, Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useOptimistic } from "react";
import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import type { PurchaseRequestListRow } from "@/lib/queries/purchase-requests";
import {
  approvePR,
  rejectPR,
  sendForRevision,
} from "@/app/actions/purchase-requests";
import { DataTable, getRowId, type DataTableColumn } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ExecutionTypeBadge } from "@/components/shared/ExecutionTypeBadge";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { usePageKeyboardHandlers } from "@/components/providers/dashboard-ui-provider";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import type { Paginated } from "@/lib/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useServerMutation } from "@/lib/use-server-mutation";
import Link from "next/link";

const ConfirmDialog = dynamic(
  () => import("@/components/shared/ConfirmDialog").then((m) => ({ default: m.ConfirmDialog })),
  { ssr: false },
);
const TextareaActionDialog = dynamic(
  () =>
    import("@/components/shared/TextareaActionDialog").then((m) => ({
      default: m.TextareaActionDialog,
    })),
  { ssr: false },
);

function rowStatus(
  row: PurchaseRequestListRow,
  overrides: Record<string, PRStatus>,
): PRStatus {
  return overrides[row.id] ?? row.status;
}

export function PRListTable({
  role,
  rows,
  isPending: listNavPending,
  paginationSearchParams,
  onPageChange,
  onRowsChange,
}: {
  role: Role;
  rows: Paginated<PurchaseRequestListRow>;
  isPending: boolean;
  paginationSearchParams: Record<string, string | undefined>;
  onPageChange: (page: number) => void;
  onRowsChange: () => void;
}) {
  const router = useRouter();
  const isOps = role === Role.OPS_HEAD;
  const { isPending: actionPending, run } = useServerMutation({ onRefresh: onRowsChange });
  const [optimisticStatuses, setOptimisticStatuses] = useOptimistic(
    {} as Record<string, PRStatus>,
    (current, update: { id: string; status: PRStatus }) => ({
      ...current,
      [update.id]: update.status,
    }),
  );
  const isPending = listNavPending || actionPending;

  const [approveId, setApproveId] = React.useState<string | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [revisionId, setRevisionId] = React.useState<string | null>(null);

  const handleRowClick = React.useCallback(
    (r: PurchaseRequestListRow) => router.push(`/purchase-requests/${r.id}`),
    [router],
  );

  const columns: DataTableColumn<PurchaseRequestListRow>[] = React.useMemo(() => {
    const base: DataTableColumn<PurchaseRequestListRow>[] = [
      {
        id: "id",
        header: "Reference",
        variant: "id",
        cell: (r) => <ProcurementRefLink id={r.id} />,
      },
      { id: "cat", header: "Items", cell: (r) => r.lineSummary },
      { id: "sub", header: "Primary item", cell: (r) => r.subcategoryName },
      { id: "wh", header: "Warehouse", cell: (r) => r.warehouseName },
      { id: "qty", header: "Qty", variant: "numeric", cell: (r) => r.quantity },
      {
        id: "vendor",
        header: "Vendor",
        cell: (r) => r.vendorName ?? "—",
      },
      {
        id: "exec",
        header: "Execution",
        cell: (r) => <ExecutionTypeBadge type={r.executionType} />,
      },
      {
        id: "status",
        header: "Status",
        cell: (r) => {
          const status = rowStatus(r, optimisticStatuses);
          return (
            <StatusBadge
              kind="PRStatus"
              status={status}
              awaitingPurchaseOrder={
                r.executionType === ExecutionType.VENDOR_PURCHASE &&
                status === PRStatus.APPROVED
              }
            />
          );
        },
      },
      { id: "ver", header: "Version", cell: (r) => r.versionLabel },
      { id: "by", header: "Created by", cell: (r) => r.createdByName },
      { id: "on", header: "Created on", variant: "date", cell: (r) => formatDateTimeMedium(r.createdAt) },
    ];

    if (isOps) {
      base.push({
        id: "actions",
        header: "",
        revealOnHover: true,
        cell: (r) => {
          const status = rowStatus(r, optimisticStatuses);
          if (
            r.executionType !== ExecutionType.VENDOR_PURCHASE ||
            status !== PRStatus.PENDING_APPROVAL
          ) {
            return null;
          }
          return (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-ds-xs font-medium text-primary hover:text-primary"
                disabled={actionPending}
                onClick={() => setApproveId(r.id)}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-ds-xs font-medium text-destructive hover:text-destructive"
                disabled={actionPending}
                onClick={() => setRejectId(r.id)}
              >
                Reject
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-ds-xs font-medium text-status-warning hover:text-status-warning"
                disabled={actionPending}
                onClick={() => setRevisionId(r.id)}
              >
                Revise
              </Button>
            </div>
          );
        },
      });
    }

    return base;
  }, [isOps, optimisticStatuses, actionPending]);

  const firstPendingApproval = React.useMemo(
    () =>
      rows.items.find(
        (r) =>
          r.executionType === ExecutionType.VENDOR_PURCHASE &&
          rowStatus(r, optimisticStatuses) === PRStatus.PENDING_APPROVAL,
      ),
    [rows.items, optimisticStatuses],
  );

  usePageKeyboardHandlers({
    onApprove: () => {
      if (firstPendingApproval) {
        setApproveId(firstPendingApproval.id);
      }
    },
    onReject: () => {
      if (firstPendingApproval) {
        setRejectId(firstPendingApproval.id);
      }
    },
  });

  if (rows.items.length === 0) {
    return (
      <EmptyState
        variant="onboarding"
        title="No purchase requests yet"
        description="Raise your first request to start the procurement flow."
        steps={[
          "Choose vendor purchase or internal print",
          "Add line items and quantities",
          "Submit for Ops Head approval",
        ]}
        action={
          <Link href="/purchase-requests/new" className={cn(buttonVariants({ variant: "gradient" }))}>
            Create PR
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div
        className={cn(
          "transition-opacity duration-150",
          isPending && "pointer-events-none opacity-50",
        )}
      >
        <DataTable
          columns={columns}
          data={rows.items}
          getRowKey={getRowId}
          onRowClick={handleRowClick}
        />
      </div>
      <Pagination
        basePath="/purchase-requests"
        page={rows.page}
        pageSize={rows.pageSize}
        total={rows.total}
        totalPages={rows.totalPages}
        hasNextPage={rows.hasNextPage}
        searchParams={paginationSearchParams}
        onPageChange={onPageChange}
      />

      <ConfirmDialog
        open={approveId != null}
        onOpenChange={(o) => !o && setApproveId(null)}
        title="Approve purchase request?"
        description="Approves the request. Configure vendor, pricing, and delivery under Purchase Orders."
        confirmLabel="Approve"
        onConfirm={() => {
          if (!approveId) {
            return;
          }
          const id = approveId;
          setApproveId(null);
          void run(
            () =>
              approvePR(id, {
                approvedCatalogItemIds: [],
                rejected: [],
              }),
            {
              onSuccess: () => {
                setOptimisticStatuses({ id, status: PRStatus.APPROVED });
                toast.success("PR approved. Create the purchase order when ready.");
              },
              onError: (m) => toast.error(m),
            },
          );
        }}
      />

      <TextareaActionDialog
        open={rejectId != null}
        onOpenChange={(o) => !o && setRejectId(null)}
        title="Reject purchase request"
        description="Provide a reason for rejection. This is recorded in version history."
        label="Rejection reason"
        confirmLabel="Reject"
        onConfirm={(text) => {
          if (!rejectId) {
            return;
          }
          const id = rejectId;
          setRejectId(null);
          void run(() => rejectPR(id, text), {
            onSuccess: () => {
              setOptimisticStatuses({ id, status: PRStatus.REJECTED });
              toast.success("PR rejected.");
            },
            onError: (m) => toast.error(m),
          });
        }}
      />

      <TextareaActionDialog
        open={revisionId != null}
        onOpenChange={(o) => !o && setRevisionId(null)}
        title="Send for revision"
        description="The store manager must address your comments and resubmit."
        label="Revision comment"
        confirmLabel="Send for revision"
        onConfirm={(text) => {
          if (!revisionId) {
            return;
          }
          const id = revisionId;
          setRevisionId(null);
          void run(() => sendForRevision(id, text), {
            onSuccess: () => {
              setOptimisticStatuses({ id, status: PRStatus.REVISION_REQUIRED });
              toast.success("Sent for revision.");
            },
            onError: (m) => toast.error(m),
          });
        }}
      />
    </>
  );
}
