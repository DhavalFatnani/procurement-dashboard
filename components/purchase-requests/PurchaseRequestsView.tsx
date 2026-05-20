"use client";

import { ExecutionType, PRStatus, Role } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  approvePR,
  rejectPR,
  sendForRevision,
  type CategoryOption,
  type PurchaseRequestListRow,
  type SubcategoryOption,
  type UserOption,
  type WarehouseOption,
} from "@/app/actions/purchase-requests";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ExecutionTypeBadge } from "@/components/shared/ExecutionTypeBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Paginated } from "@/lib/pagination";
import { TextareaActionDialog } from "@/components/shared/TextareaActionDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ALL_STATUSES = Object.values(PRStatus);

function formatDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export function PurchaseRequestsView({
  role,
  rows,
  filters,
  filterOptions,
}: {
  role: Role;
  rows: Paginated<PurchaseRequestListRow>;
  filters: {
    statuses: PRStatus[];
    categoryId: string;
    subcategoryId: string;
    executionType: string;
    warehouseId: string;
    createdById: string;
    dateFrom: string;
    dateTo: string;
  };
  filterOptions: {
    categories: CategoryOption[];
    subcategories: SubcategoryOption[];
    warehouses: WarehouseOption[];
    creators: UserOption[];
  };
}) {
  const router = useRouter();
  const isOps = role === Role.OPS_HEAD;
  const [approveId, setApproveId] = React.useState<string | null>(null);
  const [rejectId, setRejectId] = React.useState<string | null>(null);
  const [revisionId, setRevisionId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const subcatsForCategory = filterOptions.subcategories.filter(
    (s) => !filters.categoryId || s.categoryId === filters.categoryId,
  );

  const columns: DataTableColumn<PurchaseRequestListRow>[] = React.useMemo(() => {
    const base: DataTableColumn<PurchaseRequestListRow>[] = [
      { id: "id", header: "PR ID", variant: "id", cell: (r) => r.id },
      { id: "cat", header: "Category", cell: (r) => r.categoryName },
      { id: "sub", header: "Subcategory", cell: (r) => r.subcategoryName },
      { id: "wh", header: "Warehouse", cell: (r) => r.warehouseName },
      { id: "qty", header: "Qty", variant: "numeric", cell: (r) => r.quantity },
      {
        id: "vendor",
        header: "Vendor",
        cell: (r) => r.vendorName ?? (r.executionType === ExecutionType.INTERNAL_PRINT ? "—" : "—"),
      },
      {
        id: "exec",
        header: "Execution",
        cell: (r) => <ExecutionTypeBadge type={r.executionType} />,
      },
      {
        id: "status",
        header: "Status",
        cell: (r) => <StatusBadge kind="PRStatus" status={r.status} />,
      },
      { id: "ver", header: "Version", cell: (r) => r.versionLabel },
      { id: "by", header: "Created by", cell: (r) => r.createdByName },
      { id: "on", header: "Created on", variant: "date", cell: (r) => formatDate(r.createdAt) },
    ];

    if (isOps) {
      base.push({
        id: "actions",
        header: "",
        revealOnHover: true,
        cell: (r) => {
          if (
            r.executionType !== ExecutionType.VENDOR_PURCHASE ||
            r.status !== PRStatus.PENDING_APPROVAL
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
                onClick={() => setApproveId(r.id)}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-ds-xs font-medium text-destructive hover:text-destructive"
                onClick={() => setRejectId(r.id)}
              >
                Reject
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-ds-xs font-medium text-status-warning hover:text-status-warning"
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
  }, [isOps]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase requests"
        subtitle="Raise and track procurement requests through approval and PO conversion."
        action={
          <Link href="/purchase-requests/new" className={cn(buttonVariants())}>
            Create PR
          </Link>
        }
      />

      <form
        className="grid gap-3 rounded-lg border border-border-subtle bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
        method="get"
      >
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <span className="text-sm font-medium">Status</span>
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  name="status"
                  value={s}
                  defaultChecked={filters.statuses.includes(s)}
                  className="size-3.5 rounded border-input"
                />
                {s.replaceAll("_", " ")}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="categoryId" className="text-sm font-medium">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={filters.categoryId}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">All</option>
            {filterOptions.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="subcategoryId" className="text-sm font-medium">
            Subcategory
          </label>
          <select
            id="subcategoryId"
            name="subcategoryId"
            defaultValue={filters.subcategoryId}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">All</option>
            {subcatsForCategory.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="executionType" className="text-sm font-medium">
            Execution type
          </label>
          <select
            id="executionType"
            name="executionType"
            defaultValue={filters.executionType}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">All</option>
            <option value={ExecutionType.VENDOR_PURCHASE}>Vendor purchase</option>
            <option value={ExecutionType.INTERNAL_PRINT}>Internal print</option>
          </select>
        </div>

        {isOps ? (
          <div className="space-y-1.5">
            <label htmlFor="warehouseId" className="text-sm font-medium">
              Warehouse
            </label>
            <select
              id="warehouseId"
              name="warehouseId"
              defaultValue={filters.warehouseId}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              <option value="">All</option>
              {filterOptions.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {isOps ? (
          <div className="space-y-1.5">
            <label htmlFor="createdById" className="text-sm font-medium">
              Created by
            </label>
            <select
              id="createdById"
              name="createdById"
              defaultValue={filters.createdById}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              <option value="">All</option>
              {filterOptions.creators.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="dateFrom" className="text-sm font-medium">
            From date
          </label>
          <Input id="dateFrom" name="dateFrom" type="date" defaultValue={filters.dateFrom} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="dateTo" className="text-sm font-medium">
            To date
          </label>
          <Input id="dateTo" name="dateTo" type="date" defaultValue={filters.dateTo} />
        </div>

        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <Button type="submit">Apply filters</Button>
        </div>
      </form>

      {rows.items.length === 0 ? (
        <EmptyState
          title="No purchase requests yet"
          description="Raise your first request to start the procurement flow."
          action={
            <Link href="/purchase-requests/new" className={cn(buttonVariants({ variant: "outline" }))}>
              Create PR
            </Link>
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows.items}
            getRowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/purchase-requests/${r.id}`)}
          />
          <Pagination
            basePath="/purchase-requests"
            page={rows.page}
            pageSize={rows.pageSize}
            total={rows.total}
            totalPages={rows.totalPages}
            searchParams={{
              categoryId: filters.categoryId || undefined,
              subcategoryId: filters.subcategoryId || undefined,
              executionType: filters.executionType || undefined,
              warehouseId: filters.warehouseId || undefined,
              createdById: filters.createdById || undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={approveId != null}
        onOpenChange={(o) => !o && setApproveId(null)}
        title="Approve purchase request?"
        description="This will approve the PR and create a linked purchase order."
        confirmLabel="Approve"
        onConfirm={() => {
          if (!approveId) {
            return;
          }
          const id = approveId;
          setApproveId(null);
          startTransition(async () => {
            const r = await approvePR(id);
            if (r.ok) {
              toast.success("PR approved and PO created.");
              router.refresh();
            } else {
              toast.error(r.message ?? "Approval failed.");
            }
          });
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
          startTransition(async () => {
            const r = await rejectPR(id, text);
            if (r.ok) {
              toast.success("PR rejected.");
              router.refresh();
            } else {
              toast.error(r.message ?? "Reject failed.");
            }
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
          startTransition(async () => {
            const r = await sendForRevision(id, text);
            if (r.ok) {
              toast.success("Sent for revision.");
              router.refresh();
            } else {
              toast.error(r.message ?? "Failed to send for revision.");
            }
          });
        }}
      />
    </div>
  );
}
