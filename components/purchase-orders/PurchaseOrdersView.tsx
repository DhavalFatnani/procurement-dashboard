"use client";

import Link from "next/link";
import { POStatus, Role } from "@/lib/prisma-enums";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Avatar } from "@/components/shared/Avatar";
import {
  DataTable,
  getRowId,
  type DataTableColumn,
  type DataTableDensity,
} from "@/components/shared/DataTable";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { PageHeader } from "@/components/shared/PageHeader";
import { POProgressBar } from "@/components/shared/POProgressBar";
import { Pagination } from "@/components/shared/Pagination";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { Button, buttonVariants } from "@/components/ui/button";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import type { WarehouseOption } from "@/lib/format-warehouse";
import { formatDateMedium } from "@/lib/format-datetime";
import { listBreadcrumbs } from "@/lib/lineage";
import type { Paginated } from "@/lib/pagination";
import type { PurchaseOrderListRow } from "@/lib/queries/purchase-orders";
import { useListNavigation } from "@/lib/use-list-navigation";
import { cn } from "@/lib/utils";

const DENSITY_KEY = "knot:po-list:density";

function useDensity(): [DataTableDensity, (d: DataTableDensity) => void] {
  const [density, setDensity] = React.useState<DataTableDensity>("compact");
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DENSITY_KEY);
    if (stored === "compact" || stored === "cozy") {
      setDensity(stored);
    }
  }, []);
  const update = React.useCallback((d: DataTableDensity) => {
    setDensity(d);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DENSITY_KEY, d);
    }
  }, []);
  return [density, update];
}

export function PurchaseOrdersView({
  role,
  initialRows,
  awaitingPanel,
  fulfillPrId,
  filters,
  filterOptions,
}: {
  role: Role;
  initialRows: Paginated<PurchaseOrderListRow>;
  awaitingPanel?: React.ReactNode;
  fulfillPrId?: string;
  filters: {
    status: string;
    vendorId: string;
    warehouseId: string;
    dateFrom: string;
    dateTo: string;
  };
  filterOptions: {
    vendors: { id: string; businessName: string }[];
    warehouses: WarehouseOption[];
  };
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { navigate, isPending } = useListNavigation();
  const isFinance = role === Role.FINANCE;
  const isOps = role === Role.OPS_HEAD;
  const rows = initialRows;
  const [density, setDensity] = useDensity();

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["status", "vendorId", "warehouseId", "dateFrom", "dateTo"]) {
      const v = String(fd.get(key) ?? "").trim();
      if (v) params.set(key, v);
    }
    const qs = params.toString();
    navigate(qs ? `/purchase-orders?${qs}` : "/purchase-orders");
  }

  function clearFilter(key: keyof typeof filters) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.delete("page");
    const qs = params.toString();
    navigate(qs ? `/purchase-orders?${qs}` : "/purchase-orders");
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    if (page > 1) params.set("exactCount", "1");
    const qs = params.toString();
    navigate(qs ? `/purchase-orders?${qs}` : "/purchase-orders");
  }

  const columns: DataTableColumn<PurchaseOrderListRow>[] = React.useMemo(
    () => [
      {
        id: "id",
        header: "Reference",
        cell: (r) => <ProcurementRefLink id={r.id} className="font-medium" />,
        variant: "id",
      },
      {
        id: "vendor",
        header: "Vendor",
        cell: (r) => (
          <span className="inline-flex items-center gap-2">
            <Avatar name={r.vendorName} size="sm" />
            <span className="truncate">{r.vendorName}</span>
          </span>
        ),
      },
      ...(!isFinance
        ? [
            {
              id: "prId",
              header: "Linked PR",
              cell: (r: PurchaseOrderListRow) => (
                <ProcurementRefLink id={r.prId} className="text-primary" />
              ),
              variant: "id" as const,
            },
          ]
        : []),
      {
        id: "progress",
        header: "Lifecycle",
        cell: (r) => (
          <div className="min-w-[260px]">
            <POProgressBar status={r.poStatus} size="sm" />
          </div>
        ),
      },
      {
        id: "invoice",
        header: "Invoice",
        cell: (r) => <StatusBadge kind="InvoiceMatchStatus" status={r.invoiceMatchStatus} />,
      },
      {
        id: "payment",
        header: "Payment",
        cell: (r) => <StatusBadge kind="PaymentStatus" status={r.paymentStatus} />,
      },
      {
        id: "expected",
        header: "Expected",
        cell: (r) => formatDateMedium(r.expectedDelivery),
        variant: "date",
      },
      ...(!isFinance
        ? [
            {
              id: "warehouse",
              header: "Warehouse",
              cell: (r: PurchaseOrderListRow) => r.warehouseName,
            },
          ]
        : []),
    ],
    [isFinance],
  );

  const vendor = filters.vendorId
    ? filterOptions.vendors.find((v) => v.id === filters.vendorId)
    : null;
  const warehouse = filters.warehouseId
    ? filterOptions.warehouses.find((w) => w.id === filters.warehouseId)
    : null;

  const chipSpecs: FilterChipSpec[] = compactChipSpecs([
    filters.status && {
      key: "status",
      tone: "info",
      label: `Status: ${filters.status.replaceAll("_", " ")}`,
      onClear: () => clearFilter("status"),
    },
    vendor && {
      key: "vendor",
      tone: "accent",
      label: `Vendor: ${vendor.businessName}`,
      onClear: () => clearFilter("vendorId"),
    },
    warehouse && {
      key: "warehouse",
      tone: "neutral",
      label: `Warehouse: ${warehouse.label}`,
      onClear: () => clearFilter("warehouseId"),
    },
    filters.dateFrom && {
      key: "dateFrom",
      tone: "neutral",
      label: `From ${formatDateMedium(filters.dateFrom)}`,
      onClear: () => clearFilter("dateFrom"),
    },
    filters.dateTo && {
      key: "dateTo",
      tone: "neutral",
      label: `To ${formatDateMedium(filters.dateTo)}`,
      onClear: () => clearFilter("dateTo"),
    },
  ]);

  function clearAllFilters() {
    navigate("/purchase-orders");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        variant="hero"
        breadcrumbs={listBreadcrumbs("/purchase-orders")}
        title="Purchase orders"
        subtitle="PO lifecycle, reconciliation, and closure."
        action={
          <div className="flex items-center gap-1 rounded-md border border-border-subtle bg-card p-0.5">
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={cn(
                "rounded-sm px-2 py-1 text-ds-2xs font-medium transition-colors duration-fast",
                density === "compact"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={density === "compact"}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setDensity("cozy")}
              className={cn(
                "rounded-sm px-2 py-1 text-ds-2xs font-medium transition-colors duration-fast",
                density === "cozy"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={density === "cozy"}
            >
              Cozy
            </button>
          </div>
        }
      />

      {isOps ? awaitingPanel : null}

      <form onSubmit={handleFilterSubmit}>
        <FilterBar
          resultCount={rows.total ?? undefined}
          activeChips={
            chipSpecs.length > 0 ? (
              <FilterChipsRow chips={chipSpecs} onClearAll={clearAllFilters} />
            ) : undefined
          }
        >
          <FilterSelect
            name="status"
            defaultValue={filters.status}
            placeholder="All statuses"
            ariaLabel="Status"
            triggerClassName="w-[160px]"
            options={Object.values(POStatus).map((s) => ({
              value: s,
              label: s.replaceAll("_", " "),
            }))}
          />
          <FilterSelect
            name="vendorId"
            defaultValue={filters.vendorId}
            placeholder="All vendors"
            ariaLabel="Vendor"
            triggerClassName="w-[180px]"
            options={filterOptions.vendors.map((v) => ({
              value: v.id,
              label: v.businessName,
            }))}
          />
          {!isFinance ? (
            <FilterSelect
              name="warehouseId"
              defaultValue={filters.warehouseId}
              placeholder="All warehouses"
              ariaLabel="Warehouse"
              triggerClassName="w-[160px]"
              options={filterOptions.warehouses.map((w) => ({
                value: w.id,
                label: w.label,
              }))}
            />
          ) : null}
          <DateRangeFilter
            defaultFrom={filters.dateFrom}
            defaultTo={filters.dateTo}
          />
          <Button type="submit" size="sm" className="h-8">
            Apply
          </Button>
        </FilterBar>
      </form>

      {rows.items.length === 0 ? (
        <EmptyState
          variant="filtered"
          title="No purchase orders"
          description="Adjust filters or create a PO from an approved purchase request."
          action={
            <Link href="/purchase-requests?status=APPROVED" className={cn(buttonVariants({ variant: "gradient" }))}>
              View approved PRs
            </Link>
          }
        />
      ) : (
        <div className={cn("space-y-4 transition-opacity duration-fast", isPending && "opacity-60")}>
          <DataTable
            columns={columns}
            data={rows.items}
            getRowKey={getRowId}
            density={density}
            onRowClick={(r) => router.push(`/purchase-orders/${r.id}`)}
          />
          <Pagination
            basePath="/purchase-orders"
            page={rows.page}
            pageSize={rows.pageSize}
            total={rows.total}
            totalPages={rows.totalPages}
            hasNextPage={rows.hasNextPage}
            searchParams={{
              status: filters.status || undefined,
              vendorId: filters.vendorId || undefined,
              warehouseId: filters.warehouseId || undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
            }}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
