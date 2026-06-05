"use client";

import Link from "next/link";
import { canManageFinance } from "@/lib/admin-access";
import { InvoiceMatchStatus, PaymentStatus, Role } from "@/lib/prisma-enums";
import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { exportInvoiceSettlementCsv } from "@/app/actions/finance-export";
import type { PaymentListRow } from "@/lib/queries/payments";
import { downloadCsvFile } from "@/lib/download-csv";
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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import {
  formatGrnReceiptsSummary,
  formatProcurementRef,
} from "@/lib/display-ref";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import type { Paginated } from "@/lib/pagination";
import { settlementCompositionLabel } from "@/lib/settlement-helpers";
import { useListNavigation } from "@/lib/use-list-navigation";
import { Button } from "@/components/ui/button";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import { listBreadcrumbs } from "@/lib/lineage";

const BASE_PATH = FINANCE_ROUTES.invoiceSettlement;
const getPaymentRowKey = (r: PaymentListRow) => r.invoiceId;

type InvoiceSettlementFilters = {
  paymentStatus: string;
  matchStatus: string;
  vendorId: string;
  poId: string;
  dateFrom: string;
  dateTo: string;
};

type FilterScalarKey = keyof InvoiceSettlementFilters;

export function InvoiceSettlementList({
  role,
  initialRows,
  filters,
  filterOptions,
  onExportCsv,
}: {
  role: Role;
  initialRows: Paginated<PaymentListRow>;
  filters: InvoiceSettlementFilters;
  filterOptions: { vendors: { id: string; businessName: string }[] };
  onExportCsv?: () => void;
}) {
  const searchParams = useSearchParams();
  const { navigate } = useListNavigation();
  const isFinance = canManageFinance(role);
  const rows = initialRows;
  const [exporting, setExporting] = React.useState(false);

  const handleExportCsv = React.useCallback(async () => {
    if (!isFinance) return;
    setExporting(true);
    const res = await exportInvoiceSettlementCsv({
      paymentStatus: (filters.paymentStatus || undefined) as PaymentStatus | undefined,
      matchStatus: (filters.matchStatus || undefined) as InvoiceMatchStatus | undefined,
      vendorId: filters.vendorId || undefined,
      poId: filters.poId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    });
    setExporting(false);
    if (!res.ok) {
      toast.error(res.message ?? "Export failed.");
      return;
    }
    downloadCsvFile(res.csv, res.filename);
  }, [filters, isFinance]);

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
    filters.paymentStatus && {
      key: "paymentStatus",
      tone: "info",
      label: `Payment: ${filters.paymentStatus.replaceAll("_", " ")}`,
      onClear: () => clearFilter("paymentStatus"),
    },
    filters.matchStatus && {
      key: "matchStatus",
      tone: "warning",
      label: `Match: ${filters.matchStatus.replaceAll("_", " ")}`,
      onClear: () => clearFilter("matchStatus"),
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

  const openInvoice = React.useCallback(
    (invoiceId: string) => {
      navigate(FINANCE_ROUTES.invoiceDetail(invoiceId));
    },
    [navigate],
  );

  const handleRowClick = React.useCallback(
    (r: PaymentListRow) => {
      if (isFinance && r.paymentStatus !== PaymentStatus.PAID) {
        openInvoice(r.invoiceId);
      }
    },
    [isFinance, openInvoice],
  );

  const columns: DataTableColumn<PaymentListRow>[] = React.useMemo(() => {
    const invoiceCol: DataTableColumn<PaymentListRow> = {
      id: "invoice",
      header: "Invoice #",
      cell: (r) =>
        isFinance ? (
          <Link
            href={FINANCE_ROUTES.invoiceDetail(r.invoiceId)}
            className="font-medium text-primary hover:underline"
          >
            {r.invoiceNumber}
          </Link>
        ) : (
          <span className="text-ds-sm">{r.invoiceNumber}</span>
        ),
    };

    const poCol: DataTableColumn<PaymentListRow> = {
      id: "po",
      header: "Purchase order",
      cell: (r) => <ProcurementRefLink id={r.poId} className="font-medium" />,
    };

    const vendorCol: DataTableColumn<PaymentListRow> = {
      id: "vendor",
      header: "Vendor",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          {r.vendorName}
          {r.vendorUpdatedAfterPo ? (
            <span
              className="inline-flex text-status-warning"
              title={`Vendor details were updated on ${formatDateMedium(r.vendorUpdatedAt)} — verify bank details before payment. IFSC: ${r.vendorIfsc}`}
            >
              <AlertTriangle className="size-3.5" strokeWidth={1.5} aria-hidden />
            </span>
          ) : null}
        </span>
      ),
    };

    const amountCol: DataTableColumn<PaymentListRow> = {
      id: "amount",
      header: "Amount",
      variant: "numeric",
      cell: (r) => {
        if (r.paymentStatus !== PaymentStatus.PARTIALLY_PAID) {
          return formatInr(r.invoiceAmount);
        }
        const total = Number(r.invoiceAmount);
        const paid = Number(r.paidTotal);
        const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
        return (
          <span className="flex flex-col items-end gap-1 text-right">
            <span className="block whitespace-nowrap">
              <span className="font-semibold tabular-nums text-foreground">
                {formatInr(r.paidTotal)}
              </span>
              <span className="text-muted-foreground"> / {formatInr(r.invoiceAmount)}</span>
            </span>
            <span className="h-1 w-28 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full rounded-full bg-[var(--status-warning)] transition-all duration-slow"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="block text-ds-2xs text-muted-foreground">
              {formatInr(r.remaining)} remaining
            </span>
          </span>
        );
      },
    };

    const matchCol: DataTableColumn<PaymentListRow> = {
      id: "match",
      header: "Match",
      cell: (r) => <StatusBadge kind="InvoiceMatchStatus" status={r.matchStatus} />,
    };

    const paymentCol: DataTableColumn<PaymentListRow> = {
      id: "pay",
      header: "Payment",
      cell: (r) => <StatusBadge kind="PaymentStatus" status={r.paymentStatus} />,
    };

    if (isFinance) {
      return [
        invoiceCol,
        poCol,
        vendorCol,
        {
          id: "receipts",
          header: "Receipts",
          cell: (r) =>
            formatGrnReceiptsSummary(
              r.grnReceiptDates.map((d) => ({ receivedAt: d })),
            ),
        },
        amountCol,
        {
          id: "expected",
          header: "Expected",
          variant: "numeric",
          cell: (r) => (r.expectedAmount ? formatInr(r.expectedAmount) : "—"),
        },
        {
          id: "advance",
          header: "Advance on PO",
          variant: "numeric",
          cell: (r) => {
            const unallocated = Number(r.advanceUnallocatedOnPo);
            if (unallocated > 0) {
              return (
                <span className="font-semibold tabular-nums text-[var(--status-info)]">
                  {formatInr(r.advanceUnallocatedOnPo)}
                </span>
              );
            }
            if (r.hasPendingAdvanceRequest) {
              return (
                <Chip tone="warning" size="sm" variant="soft">
                  Requested
                </Chip>
              );
            }
            return <span className="text-muted-foreground">—</span>;
          },
        },
        matchCol,
        paymentCol,
        {
          id: "settledVia",
          header: "Settled via",
          cell: (r) =>
            r.settledVia === "unpaid" ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <Chip tone="neutral" size="sm" variant="soft">
                {settlementCompositionLabel(r.settledVia)}
              </Chip>
            ),
        },
        {
          id: "uploadedBy",
          header: "Uploaded by",
          cell: (r) => r.uploadedByName,
        },
        {
          id: "latest",
          header: "Latest payment",
          cell: (r) => {
            if (!r.paidAt && !r.method && !r.transactionRef && !r.paidByName) {
              return <span className="text-muted-foreground">—</span>;
            }
            return (
              <div className="flex flex-col gap-0.5 text-ds-xs">
                <span className="text-foreground">
                  {r.method ?? "—"}
                  {r.paidAt ? ` · ${formatDateMedium(r.paidAt)}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {r.transactionRef ? `Txn ${r.transactionRef}` : "No reference"}
                  {r.paidByName ? ` · ${r.paidByName}` : ""}
                </span>
              </div>
            );
          },
        },
        {
          id: "actions",
          header: "Actions",
          cell: (r) =>
            r.paymentStatus === PaymentStatus.PAID ? (
              <Link
                href={FINANCE_ROUTES.invoiceDetail(r.invoiceId)}
                className="text-ds-xs text-primary hover:underline"
              >
                View
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                render={
                  <Link href={FINANCE_ROUTES.invoiceDetail(r.invoiceId)} />
                }
              >
                Settle
              </Button>
            ),
        },
      ];
    }

    return [
      invoiceCol,
      poCol,
      vendorCol,
      amountCol,
      matchCol,
      paymentCol,
      { id: "method", header: "Method", cell: (r) => r.method ?? "—" },
      { id: "txn", header: "Transaction ID", cell: (r) => r.transactionRef ?? "—" },
      { id: "by", header: "Paid by", cell: (r) => r.paidByName ?? "—" },
      {
        id: "on",
        header: "Paid date",
        variant: "date",
        cell: (r) => formatDateMedium(r.paidAt),
      },
    ];
  }, [isFinance]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={listBreadcrumbs(BASE_PATH)}
        title={isFinance ? "Invoice settlement" : "Payments"}
        subtitle={
          isFinance
            ? "Review matched invoices, apply PO advance credit, and record bank transfers."
            : "Read-only payment status across invoices."
        }
      />

      <FilterBar
        resultCount={rows.total ?? undefined}
        onExportCsv={
          isFinance ? (onExportCsv ?? (exporting ? undefined : handleExportCsv)) : undefined
        }
        activeChips={
          chipSpecs.length > 0 ? (
            <FilterChipsRow chips={chipSpecs} onClearAll={clearAllFilters} />
          ) : undefined
        }
      >
        {isFinance ? (
          <form onSubmit={handlePoSearchSubmit} className="inline-flex">
            <FilterSearch
              name="poId"
              defaultValue={filters.poId}
              placeholder="PO id"
              ariaLabel="Purchase order id"
              width="w-[160px]"
            />
          </form>
        ) : null}
        <FilterSelect
          name="paymentStatus"
          defaultValue={filters.paymentStatus}
          placeholder="All payment"
          ariaLabel="Payment status"
          triggerClassName="w-[160px]"
          onValueChange={(v) => setFilter("paymentStatus", v)}
          options={Object.values(PaymentStatus).map((s) => ({
            value: s,
            label: s.replaceAll("_", " "),
          }))}
        />
        <FilterSelect
          name="matchStatus"
          defaultValue={filters.matchStatus}
          placeholder="All match"
          ariaLabel="Match status"
          triggerClassName="w-[160px]"
          onValueChange={(v) => setFilter("matchStatus", v)}
          options={Object.values(InvoiceMatchStatus).map((s) => ({
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
          title="No invoices to show"
          description="No invoices match these filters."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows.items}
            getRowKey={getPaymentRowKey}
            onRowClick={isFinance ? handleRowClick : undefined}
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
              paymentStatus: filters.paymentStatus || undefined,
              matchStatus: filters.matchStatus || undefined,
              vendorId: filters.vendorId || undefined,
              poId: filters.poId || undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
            }}
          />
        </>
      )}
    </div>
  );
}
