"use client";

import type { VendorStatus } from "@prisma/client";
import { Role } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import type { PendingVendorRequestRow, VendorListRow } from "@/app/actions/vendors";
import { AddVendorSheet } from "@/components/vendors/AddVendorSheet";
import { ReviewVendorRequestSheet } from "@/components/vendors/ReviewVendorRequestSheet";
import { VendorRowActions } from "@/components/vendors/VendorRowActions";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Paginated } from "@/lib/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function VendorsView({
  role,
  tab,
  vendors,
  pendingRequests,
  search,
  statusFilter,
}: {
  role: Role;
  tab: "all" | "pending";
  vendors: Paginated<VendorListRow>;
  pendingRequests: PendingVendorRequestRow[];
  search: string;
  statusFilter: VendorStatus | "ALL";
}) {
  const router = useRouter();
  const canManage = role === Role.OPS_HEAD;

  const vendorColumns: DataTableColumn<VendorListRow>[] = React.useMemo(
    () => [
      { id: "name", header: "Vendor name", cell: (r) => r.businessName },
      { id: "poc", header: "POC", cell: (r) => r.pocName },
      { id: "phone", header: "Phone", cell: (r) => r.phone },
      { id: "email", header: "Email", cell: (r) => r.email },
      {
        id: "bank",
        header: "Bank details",
        cell: (r) => <span className="font-mono text-xs">••••{r.accountLast4}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: (r) => <StatusBadge kind="VendorStatus" status={r.status} />,
      },
      { id: "by", header: "Created by", cell: (r) => r.createdByName },
      { id: "updated", header: "Last updated", cell: (r) => formatDate(r.updatedAt) },
      {
        id: "actions",
        header: "",
        revealOnHover: true,
        cell: (r) => (canManage ? <VendorRowActions row={r} /> : (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Link href={`/vendors/${r.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View
            </Link>
          </div>
        )),
      },
    ],
    [canManage],
  );

  const pendingColumns: DataTableColumn<PendingVendorRequestRow>[] = React.useMemo(
    () => [
      { id: "biz", header: "Business name", cell: (r) => r.businessName },
      { id: "poc", header: "POC", cell: (r) => r.pocName },
      { id: "phone", header: "Phone", cell: (r) => r.phone },
      { id: "by", header: "Requested by", cell: (r) => r.requestedByName },
      {
        id: "pr",
        header: "Linked PR",
        cell: (r) =>
          r.linkedPRId ? (
            <Link className="text-primary underline-offset-4 hover:underline" href={`/purchase-requests/${r.linkedPRId}`}>
              {r.linkedPRId}
            </Link>
          ) : (
            "—"
          ),
      },
      { id: "date", header: "Date", cell: (r) => formatDate(r.createdAt) },
      {
        id: "act",
        header: "",
        cell: (r) => <ReviewVendorRequestSheet request={r} />,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        subtitle={
          canManage
            ? "Manage vendor master data, bank details, and pending activation requests."
            : "View-only directory of approved vendors."
        }
        action={canManage ? <AddVendorSheet /> : undefined}
      />

      {canManage ? (
        <div className="flex gap-2 border-b">
          <TabLink href="/vendors?tab=all" active={tab === "all"}>
            All vendors
          </TabLink>
          <TabLink href="/vendors?tab=pending" active={tab === "pending"}>
            Pending requests
          </TabLink>
        </div>
      ) : null}

      {tab === "pending" && canManage ? (
        pendingRequests.length === 0 ? (
          <EmptyState
            title="No pending vendor requests"
            description="New requests from purchase flows will appear here for Ops Head review."
          />
        ) : (
          <DataTable columns={pendingColumns} data={pendingRequests} getRowKey={(r) => r.id} />
        )
      ) : (
        <>
          <form className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" method="get">
            <input type="hidden" name="tab" value="all" />
            <div className="space-y-1.5 sm:min-w-[200px]">
              <label htmlFor="q" className="text-sm font-medium">
                Search
              </label>
              <Input
                id="q"
                name="q"
                placeholder="Name, phone, or email"
                defaultValue={search}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5 sm:min-w-[160px]">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={statusFilter}
                className={cn(
                  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                )}
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <Button type="submit" className="sm:mb-0.5">
              Apply
            </Button>
          </form>

          {vendors.items.length === 0 ? (
            <EmptyState
              title="No vendors found"
              description={
                search || statusFilter !== "ALL"
                  ? "Try adjusting search or status filters."
                  : "Add your first vendor to get started."
              }
              action={
                canManage ? (
                  <p className="text-xs text-muted-foreground">Use &quot;Add vendor&quot; above.</p>
                ) : undefined
              }
            />
          ) : (
            <>
              <DataTable
                columns={vendorColumns}
                data={vendors.items}
                getRowKey={(r) => r.id}
                onRowClick={(r) => router.push(`/vendors/${r.id}`)}
              />
              <Pagination
                basePath="/vendors"
                page={vendors.page}
                pageSize={vendors.pageSize}
                total={vendors.total}
                totalPages={vendors.totalPages}
                searchParams={{
                  tab: "all",
                  q: search || undefined,
                  status: statusFilter !== "ALL" ? statusFilter : undefined,
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
