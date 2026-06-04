"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { Chip } from "@/components/shared/Chip";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { FilterSearch } from "@/components/shared/FilterSearch";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import { formatProcurementRef } from "@/lib/display-ref";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { listBreadcrumbs } from "@/lib/lineage";
import type { Paginated } from "@/lib/pagination";
import type { PaymentRegisterRow } from "@/lib/queries/payments";
import { useListNavigation } from "@/lib/use-list-navigation";

const BASE_PATH = FINANCE_ROUTES.paymentRegister;
const getRowKey = (r: PaymentRegisterRow) => `${r.kind}-${r.id}`;

type PaymentRegisterFilters = {
  vendorId: string;
  poId: string;
  type: "cash" | "advance" | "";
  dateFrom: string;
  dateTo: string;
};

type FilterScalarKey = keyof PaymentRegisterFilters;

export function PaymentRegisterView({
  initialRows,
  filters,
  filterOptions,
}: {
  initialRows: Paginated<PaymentRegisterRow>;
  filters: PaymentRegisterFilters;
  filterOptions: { vendors: { id: string; businessName: string }[] };
}) {
  const searchParams = useSearchParams();
  const { navigate } = useListNavigation();
  const rows = initialRows;

  const setFilter = React.useCallback(
    (key: FilterScalarKey, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      const qs = params.toString();
      navigate(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
    },
    [navigate, searchParams],
  );

  const clearFilter = React.useCallback(
    (key: FilterScalarKey) => setFilter(key, ""),
    [setFilter],
  );

  const handlePoSearchSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const poId = String(fd.get("poId") ?? "").trim();
      setFilter("poId", poId);
    },
    [setFilter],
  );

  const vendor = filters.vendorId
    ? filterOptions.vendors.find((v) => v.id === filters.vendorId)
    : null;

  const chipSpecs: FilterChipSpec[] = compactChipSpecs([
    filters.type && {
      key: "type",
      tone: "info",
      label: `Type: ${filters.type}`,
      onClear: () => clearFilter("type"),
    },
    vendor && {
      key: "vendor",
      tone: "accent",
      label: `Vendor: ${vendor.businessName}`,
      onClear: () => clearFilter("vendorId"),
    },
    filters.poId && {
      key: "poId",
      tone: "accent",
      label: `PO: ${formatProcurementRef(filters.poId)}`,
      onClear: () => clearFilter("poId"),
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
    navigate(BASE_PATH);
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    if (page > 1) params.set("exactCount", "1");
    const qs = params.toString();
    navigate(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  }

  const handleRowClick = React.useCallback(
    (r: PaymentRegisterRow) => {
      navigate(r.href);
    },
    [navigate],
  );

  const columns: DataTableColumn<PaymentRegisterRow>[] = React.useMemo(
    () => [
      {
        id: "date",
        header: "Date",
        variant: "date",
        cell: (r) => formatDateMedium(r.date),
      },
      {
        id: "type",
        header: "Type",
        cell: (r) => (
          <Chip tone={r.kind === "cash" ? "success" : "info"} size="sm" variant="soft">
            {r.kind === "cash" ? "Cash" : "Advance"}
          </Chip>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        variant: "numeric",
        cell: (r) => <span className="font-semibold tabular-nums">{formatInr(r.amount)}</span>,
      },
      {
        id: "invoice",
        header: "Invoice",
        cell: (r) => (
          <Link
            href={FINANCE_ROUTES.invoiceDetail(r.invoiceId)}
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.invoiceNumber}
          </Link>
        ),
      },
      {
        id: "po",
        header: "Purchase order",
        cell: (r) => <ProcurementRefLink id={r.poId} className="font-medium" />,
      },
      {
        id: "vendor",
        header: "Vendor",
        cell: (r) => r.vendorName,
      },
      {
        id: "method",
        header: "Method",
        cell: (r) => r.method ?? "—",
      },
      {
        id: "txn",
        header: "Transaction ref",
        cell: (r) =>
          r.transactionRef ? (
            <span className="font-mono text-ds-xs">{r.transactionRef}</span>
          ) : (
            "—"
          ),
      },
      {
        id: "by",
        header: "Recorded by",
        cell: (r) => r.recordedByName ?? "—",
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={listBreadcrumbs(BASE_PATH)}
        title="Payment register"
        subtitle="All cash settlements and advance credit applications across invoices."
      />

      <FilterBar
        resultCount={rows.total ?? undefined}
        activeChips={
          chipSpecs.length > 0 ? (
            <FilterChipsRow chips={chipSpecs} onClearAll={clearAllFilters} />
          ) : undefined
        }
      >
        <form onSubmit={handlePoSearchSubmit} className="inline-flex">
          <FilterSearch
            name="poId"
            defaultValue={filters.poId}
            placeholder="PO id"
            ariaLabel="Purchase order id"
            width="w-[160px]"
          />
        </form>
        <FilterSelect
          name="type"
          defaultValue={filters.type}
          placeholder="All types"
          ariaLabel="Payment type"
          triggerClassName="w-[140px]"
          onValueChange={(v) => setFilter("type", v)}
          options={[
            { value: "cash", label: "Cash" },
            { value: "advance", label: "Advance" },
          ]}
        />
        <FilterSelect
          name="vendorId"
          defaultValue={filters.vendorId}
          placeholder="All vendors"
          ariaLabel="Vendor"
          triggerClassName="w-[180px]"
          searchable
          onValueChange={(v) => setFilter("vendorId", v)}
          options={filterOptions.vendors.map((v) => ({
            value: v.id,
            label: v.businessName,
          }))}
        />
        <DateRangeFilter
          defaultFrom={filters.dateFrom}
          defaultTo={filters.dateTo}
          onFromChange={(v) => setFilter("dateFrom", v)}
          onToChange={(v) => setFilter("dateTo", v)}
        />
      </FilterBar>

      {rows.items.length === 0 ? (
        <EmptyState
          title="No payments to show"
          description="No cash or advance entries match these filters."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows.items}
            getRowKey={getRowKey}
            onRowClick={handleRowClick}
          />
          <Pagination
            basePath={BASE_PATH}
            page={rows.page}
            pageSize={rows.pageSize}
            total={rows.total}
            totalPages={rows.totalPages}
            hasNextPage={rows.hasNextPage}
            onPageChange={handlePageChange}
            searchParams={{
              vendorId: filters.vendorId || undefined,
              poId: filters.poId || undefined,
              type: filters.type || undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
            }}
          />
        </>
      )}
    </div>
  );
}
