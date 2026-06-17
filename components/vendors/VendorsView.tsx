"use client";

import { isCentralOpsOrAbove } from "@/lib/admin-access";
import type { VendorStatus } from "@/lib/prisma-enums";
import { Role } from "@/lib/prisma-enums";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { vendorParamsFromForm } from "@/lib/build-list-url";
import type { Paginated } from "@/lib/pagination";
import * as React from "react";

import type { PendingVendorRequestRow, VendorListRow } from "@/lib/queries/vendors";
import dynamic from "next/dynamic";

const AddVendorSheet = dynamic(
  () => import("@/components/vendors/AddVendorSheet").then((m) => ({ default: m.AddVendorSheet })),
  { ssr: false },
);
const ReviewVendorRequestSheet = dynamic(
  () =>
    import("@/components/vendors/ReviewVendorRequestSheet").then((m) => ({
      default: m.ReviewVendorRequestSheet,
    })),
  { ssr: false },
);
import { VendorRowActions } from "@/components/vendors/VendorRowActions";
import { Avatar } from "@/components/shared/Avatar";
import { DataTable, getRowId, type DataTableColumn } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePageKeyboardHandlers } from "@/components/providers/dashboard-ui-provider";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { FilterSearch } from "@/components/shared/FilterSearch";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import { formatShortRef } from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

export function VendorsView({
  role,
  tab,
  initialVendors,
  pendingRequests,
  search,
  statusFilter,
  openAddVendor = false,
  showHeader = true,
}: {
  role: Role;
  tab: "all" | "pending";
  initialVendors: Paginated<VendorListRow>;
  pendingRequests: PendingVendorRequestRow[];
  search: string;
  statusFilter: VendorStatus | "ALL";
  openAddVendor?: boolean;
  showHeader?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canManage = isCentralOpsOrAbove(role);
  const [addVendorOpen, setAddVendorOpen] = React.useState(openAddVendor ?? false);
  const [isPending, startTransition] = React.useTransition();
  // Optimistic: deactivating a vendor flips its row to INACTIVE instantly; the
  // value auto-reverts if the server action fails or reconciles on refresh.
  const [optimisticVendors, markVendorDeactivated] = React.useOptimistic(
    initialVendors.items,
    (rows: VendorListRow[], deactivatedId: string) =>
      rows.map((r) => (r.id === deactivatedId ? { ...r, status: "INACTIVE" as const } : r)),
  );

  const navigateVendors = React.useCallback(
    (params: URLSearchParams, options?: { exactCount?: boolean }) => {
      if (options?.exactCount) {
        params.set("exactCount", "1");
      } else {
        params.delete("exactCount");
      }
      params.set("tab", "all");
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/vendors?${qs}` : "/vendors", { scroll: false });
      });
    },
    [router],
  );

  const handleVendorRowClick = React.useCallback(
    (r: VendorListRow) => router.push(`/vendors/${r.id}`),
    [router],
  );

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    navigateVendors(vendorParamsFromForm(e.currentTarget));
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "all");
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    navigateVendors(params, { exactCount: page > 1 });
  }

  function clearFilter(key: "q" | "status") {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "status") {
      params.set("status", "ALL");
    } else {
      params.delete(key);
    }
    params.delete("page");
    navigateVendors(params);
  }

  const chipSpecs: FilterChipSpec[] = compactChipSpecs([
    search && {
      key: "q",
      tone: "neutral",
      label: `Search: "${search}"`,
      onClear: () => clearFilter("q"),
    },
    statusFilter !== "ALL" && {
      key: "status",
      tone: statusFilter === "ACTIVE" ? "success" : "neutral",
      label: `Status: ${statusFilter}`,
      onClear: () => clearFilter("status"),
    },
  ]);

  function clearAllFilters() {
    const params = new URLSearchParams();
    params.set("tab", "all");
    navigateVendors(params);
  }

  React.useEffect(() => {
    if (openAddVendor && canManage) {
      setAddVendorOpen(true);
    }
  }, [openAddVendor, canManage]);

  usePageKeyboardHandlers({
    onFocusSearch: () => {
      const el = document.querySelector<HTMLInputElement>(
        'input[name="q"][aria-label="Search vendors"]',
      );
      el?.focus();
    },
  });

  function exportVendorsCsv() {
    const header = ["ref", "businessName", "pocName", "phone", "email", "status"];
    const lines = initialVendors.items.map((v) =>
      [formatShortRef(v.id), v.businessName, v.pocName, v.phone, v.email, v.status]
        .map((c) => `"${String(c).replaceAll('"', '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const vendorColumns: DataTableColumn<VendorListRow>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Vendor name",
        cell: (r) => (
          <span className="inline-flex items-center gap-2">
            <Avatar name={r.businessName} size="sm" />
            <span className="font-medium text-foreground">{r.businessName}</span>
          </span>
        ),
      },
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
      { id: "updated", header: "Last updated", cell: (r) => formatDateTimeMedium(r.updatedAt) },
      {
        id: "actions",
        header: "",
        revealOnHover: true,
        cell: (r) => (canManage ? <VendorRowActions row={r} onDeactivated={markVendorDeactivated} /> : (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Link href={`/vendors/${r.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View
            </Link>
          </div>
        )),
      },
    ],
    [canManage, markVendorDeactivated],
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
      { id: "date", header: "Date", cell: (r) => formatDateTimeMedium(r.createdAt) },
      {
        id: "act",
        header: "",
        cell: (r) => <ReviewVendorRequestSheet request={r} />,
      },
    ],
    [],
  );

  const resultCount = initialVendors.total ?? initialVendors.items.length;

  return (
    <div className="space-y-6">
      {showHeader ? (
        <PageHeader
          variant="hero"
          title="Vendors"
          subtitle={
            canManage
              ? "Manage vendor master data, bank details, and pending activation requests."
              : "View-only directory of approved vendors."
          }
          action={
            canManage ? (
              <AddVendorSheet open={addVendorOpen} onOpenChange={setAddVendorOpen} />
            ) : undefined
          }
        />
      ) : canManage ? (
        <div className="flex justify-end">
          <AddVendorSheet open={addVendorOpen} onOpenChange={setAddVendorOpen} />
        </div>
      ) : null}

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
          <DataTable columns={pendingColumns} data={pendingRequests} getRowKey={getRowId} />
        )
      ) : (
        <>
          <form onSubmit={handleFilterSubmit}>
            <input type="hidden" name="tab" value="all" />
            <FilterBar
              resultCount={resultCount}
              onExportCsv={tab === "all" ? exportVendorsCsv : undefined}
              activeChips={
                chipSpecs.length > 0 ? (
                  <FilterChipsRow chips={chipSpecs} onClearAll={clearAllFilters} />
                ) : undefined
              }
            >
              <FilterSearch
                name="q"
                defaultValue={search}
                placeholder="Name, phone, or email"
                ariaLabel="Search vendors"
                width="w-[240px]"
              />
              <FilterSelect
                name="status"
                defaultValue={statusFilter === "ALL" ? "" : statusFilter}
                placeholder="All statuses"
                ariaLabel="Status"
                triggerClassName="w-[150px]"
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <Button type="submit" size="sm" className="h-8">
                Apply
              </Button>
            </FilterBar>
          </form>

          {initialVendors.items.length === 0 ? (
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
              <div
                className={cn(
                  "transition-opacity duration-150",
                  isPending && "pointer-events-none opacity-50",
                )}
              >
                <DataTable
                  columns={vendorColumns}
                  data={optimisticVendors}
                  getRowKey={getRowId}
                  onRowClick={handleVendorRowClick}
                />
              </div>
              <Pagination
                basePath="/vendors"
                page={initialVendors.page}
                pageSize={initialVendors.pageSize}
                total={initialVendors.total}
                totalPages={initialVendors.totalPages}
                hasNextPage={initialVendors.hasNextPage}
                searchParams={{
                  tab: "all",
                  q: search || undefined,
                  status: statusFilter !== "ALL" ? statusFilter : undefined,
                }}
                onPageChange={handlePageChange}
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
