"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import type { GRNDetail, GRNListRow } from "@/lib/queries/grn";
import { getGRNById } from "@/app/actions/grn";
import { Chip } from "@/components/shared/Chip";
import { DataTable, getRowId, type DataTableColumn } from "@/components/shared/DataTable";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { DetailDrawer } from "@/components/shared/Drawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { FilterSearch } from "@/components/shared/FilterSearch";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SheetSection } from "@/components/shared/SheetSection";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import { listBreadcrumbs } from "@/lib/lineage";
import type { Paginated } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

import { GrnReceiptLineList } from "@/components/goods-receipt/GrnReceiptLineList";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { formatGrnReceiptLabel } from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";

export function GRNListView({
  initialRows,
  filters,
  filterOptions,
}: {
  initialRows: Paginated<GRNListRow>;
  filters: {
    poId: string;
    vendorId: string;
    dateFrom: string;
    dateTo: string;
    hasExceptions: string;
  };
  filterOptions: {
    vendors: { id: string; businessName: string }[];
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows] = React.useState(initialRows);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<GRNDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const poId = String(fd.get("poId") ?? "").trim();
    const vendorId = String(fd.get("vendorId") ?? "");
    const dateFrom = String(fd.get("dateFrom") ?? "");
    const dateTo = String(fd.get("dateTo") ?? "");
    const hasExceptions = String(fd.get("hasExceptions") ?? "");
    if (poId) params.set("poId", poId);
    if (vendorId) params.set("vendorId", vendorId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (hasExceptions) params.set("hasExceptions", hasExceptions);
    const qs = params.toString();
    router.push(qs ? `/goods-receipt?${qs}` : "/goods-receipt");
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    if (page > 1) params.set("exactCount", "1");
    const qs = params.toString();
    router.push(qs ? `/goods-receipt?${qs}` : "/goods-receipt");
  }

  function clearFilter(key: keyof typeof filters) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/goods-receipt?${qs}` : "/goods-receipt");
  }

  const vendor = filters.vendorId
    ? filterOptions.vendors.find((v) => v.id === filters.vendorId)
    : null;

  const chipSpecs: FilterChipSpec[] = compactChipSpecs([
    filters.poId && {
      key: "poId",
      tone: "neutral",
      label: `PO: ${filters.poId.slice(-8).toUpperCase()}`,
      onClear: () => clearFilter("poId"),
    },
    vendor && {
      key: "vendor",
      tone: "accent",
      label: `Vendor: ${vendor.businessName}`,
      onClear: () => clearFilter("vendorId"),
    },
    filters.hasExceptions && {
      key: "hasExceptions",
      tone: filters.hasExceptions === "yes" ? "error" : "neutral",
      label:
        filters.hasExceptions === "yes" ? "Has exceptions" : "No exceptions",
      onClear: () => clearFilter("hasExceptions"),
    },
    filters.dateFrom && {
      key: "dateFrom",
      tone: "neutral",
      label: `From ${formatDateTimeMedium(filters.dateFrom)}`,
      onClear: () => clearFilter("dateFrom"),
    },
    filters.dateTo && {
      key: "dateTo",
      tone: "neutral",
      label: `To ${formatDateTimeMedium(filters.dateTo)}`,
      onClear: () => clearFilter("dateTo"),
    },
  ]);

  function clearAllFilters() {
    router.push("/goods-receipt");
  }

  const openDetail = React.useCallback(async (id: string) => {
    setSheetOpen(true);
    setLoadingDetail(true);
    setDetail(null);
    const d = await getGRNById(id);
    setDetail(d);
    setLoadingDetail(false);
  }, []);

  const columns: DataTableColumn<GRNListRow>[] = React.useMemo(() => [
    {
      id: "id",
      header: "Receipt",
      cell: (r) => (
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => void openDetail(r.id)}
        >
          {formatGrnReceiptLabel(r.poId, r.receivedAt, r.vendorName)}
        </button>
      ),
    },
    {
      id: "po",
      header: "Purchase order",
      cell: (r) => <ProcurementRefLink id={r.poId} className="font-medium" />,
    },
    { id: "vendor", header: "Vendor", cell: (r) => r.vendorName },
    { id: "recv", header: "Received", cell: (r) => r.receivedQty },
    { id: "acc", header: "Accepted", cell: (r) => r.acceptedQty },
    { id: "dis", header: "Disputed", cell: (r) => r.disputedQty },
    {
      id: "ex",
      header: "Exception",
      cell: (r) =>
        r.exceptionStatus === "Open" ? (
          <Chip tone="error" showDot>
            Open
          </Chip>
        ) : r.exceptionStatus === "Resolved" ? (
          <Chip tone="success" showDot>
            Resolved
          </Chip>
        ) : (
          <Chip tone="neutral">None</Chip>
        ),
    },
    { id: "by", header: "Received by", cell: (r) => r.receivedByName },
    { id: "at", header: "Date", cell: (r) => formatDateTimeMedium(r.receivedAt) },
  ], [openDetail]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={listBreadcrumbs("/goods-receipt")}
        title="Goods receipt"
        subtitle="Record and review inbound deliveries against purchase orders."
        action={
          <Button render={<Link href="/goods-receipt/new" />}>New GRN</Button>
        }
      />

      <form onSubmit={handleFilterSubmit}>
        <FilterBar
          resultCount={rows.total ?? undefined}
          activeChips={
            chipSpecs.length > 0 ? (
              <FilterChipsRow chips={chipSpecs} onClearAll={clearAllFilters} />
            ) : undefined
          }
        >
          <FilterSearch
            name="poId"
            defaultValue={filters.poId}
            placeholder="PO ref"
            ariaLabel="Purchase order reference"
            width="w-[160px]"
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
          <FilterSelect
            name="hasExceptions"
            defaultValue={filters.hasExceptions}
            placeholder="All receipts"
            ariaLabel="Exceptions"
            triggerClassName="w-[160px]"
            options={[
              { value: "yes", label: "Has exceptions" },
              { value: "no", label: "No exceptions" },
            ]}
          />
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
          title="No goods receipts"
          description="Record a receipt from an open purchase order."
          action={
            <Link href="/goods-receipt/new" className={buttonVariants()}>
              New GRN
            </Link>
          }
        />
      ) : (
        <>
          <DataTable columns={columns} data={rows.items} getRowKey={getRowId} />
          <Pagination
            basePath="/goods-receipt"
            page={rows.page}
            pageSize={rows.pageSize}
            total={rows.total}
            totalPages={rows.totalPages}
            hasNextPage={rows.hasNextPage}
            searchParams={{
              poId: filters.poId || undefined,
              vendorId: filters.vendorId || undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
              hasExceptions: filters.hasExceptions || undefined,
            }}
            onPageChange={handlePageChange}
          />
        </>
      )}

      <DetailDrawer
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Goods receipt"
        description={
          detail ? formatGrnReceiptLabel(detail.poId, detail.receivedAt, detail.vendorName) : undefined
        }
        width="md"
      >
        {loadingDetail ? (
          <p className="text-ds-sm text-muted-foreground">Loading…</p>
        ) : detail ? (
          <>
            <SheetSection title="Linked">
              <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm">
                <div>
                  <dt className="text-ds-xs text-muted-foreground">PO</dt>
                  <dd>
                    <ProcurementRefLink id={detail.poId} className="font-medium" />
                  </dd>
                </div>
                <div>
                  <dt className="text-ds-xs text-muted-foreground">PR</dt>
                  <dd>
                    {detail.prId ? (
                      <ProcurementRefLink id={detail.prId} className="font-medium" />
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-ds-xs text-muted-foreground">Vendor</dt>
                  <dd>{detail.vendorName}</dd>
                </div>
                {detail.deliveryNoteRef ? (
                  <div className="col-span-2">
                    <dt className="text-ds-xs text-muted-foreground">Delivery note</dt>
                    <dd className="font-mono text-ds-xs">{detail.deliveryNoteRef}</dd>
                  </div>
                ) : null}
              </dl>
            </SheetSection>

            <SheetSection title="Quantities">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Received", value: detail.receivedQty },
                  { label: "Accepted", value: detail.acceptedQty, tone: "text-[var(--status-success)]" },
                  { label: "Disputed", value: detail.disputedQty, tone: "text-[var(--status-warning)]" },
                ].map((q) => (
                  <div
                    key={q.label}
                    className="rounded-lg border border-border-subtle bg-card p-3 text-center"
                  >
                    <p className="text-ds-2xs uppercase tracking-wide text-muted-foreground">
                      {q.label}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-ds-lg font-semibold tabular-nums text-foreground",
                        q.tone,
                      )}
                    >
                      {q.value}
                    </p>
                  </div>
                ))}
              </div>
            </SheetSection>

            <GrnReceiptLineList lines={detail.lines} />

            <div className="flex justify-end">
              <Link
                href={`/purchase-orders/${detail.poId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                onClick={() => setSheetOpen(false)}
              >
                View PO
              </Link>
            </div>
          </>
        ) : (
          <p className="text-ds-sm text-muted-foreground">Not found.</p>
        )}
      </DetailDrawer>
    </div>
  );
}
