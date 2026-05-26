"use client";

import { InvoiceMatchStatus, PaymentStatus, Role } from "@prisma/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import type { InvoiceDetail, InvoiceListRow } from "@/app/actions/invoices";
import { getInvoiceById, overrideInvoiceMatch } from "@/app/actions/invoices";
import { DataTable, getRowId, type DataTableColumn } from "@/components/shared/DataTable";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { DetailDrawer } from "@/components/shared/Drawer";
import { DocumentLinks } from "@/components/shared/DocumentLinks";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { FilterSearch } from "@/components/shared/FilterSearch";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import { listBreadcrumbs } from "@/lib/lineage";
import { Pagination } from "@/components/shared/Pagination";
import { SheetSection } from "@/components/shared/SheetSection";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TextareaActionDialog } from "@/components/shared/TextareaActionDialog";
import type { Paginated } from "@/lib/pagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useListNavigation } from "@/lib/use-list-navigation";

import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { formatGrnReceiptLabel, formatGrnReceiptsSummary } from "@/lib/display-ref";
import { formatDateTimeMedium, formatInr } from "@/lib/format-datetime";

export function InvoicesView({
  role,
  initialRows,
  filters,
  filterOptions,
}: {
  role: Role;
  initialRows: Paginated<InvoiceListRow>;
  filters: {
    matchStatus: string;
    paymentStatus: string;
    vendorId: string;
    poId: string;
    dateFrom: string;
    dateTo: string;
  };
  filterOptions: { vendors: { id: string; businessName: string }[] };
}) {
  const searchParams = useSearchParams();
  const { navigate, isPending, refresh } = useListNavigation();
  const canUpload = role === Role.SM || role === Role.OPS_HEAD;
  const isOps = role === Role.OPS_HEAD;
  const rows = initialRows;
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<InvoiceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [overrideId, setOverrideId] = React.useState<string | null>(null);

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["matchStatus", "paymentStatus", "vendorId", "poId", "dateFrom", "dateTo"]) {
      const v = String(fd.get(key) ?? "").trim();
      if (v) params.set(key, v);
    }
    const qs = params.toString();
    navigate(qs ? `/invoices?${qs}` : "/invoices");
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    if (page > 1) params.set("exactCount", "1");
    const qs = params.toString();
    navigate(qs ? `/invoices?${qs}` : "/invoices");
  }

  function clearFilter(key: keyof typeof filters) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.delete("page");
    const qs = params.toString();
    navigate(qs ? `/invoices?${qs}` : "/invoices");
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
    filters.matchStatus && {
      key: "matchStatus",
      tone: "warning",
      label: `Match: ${filters.matchStatus.replaceAll("_", " ")}`,
      onClear: () => clearFilter("matchStatus"),
    },
    filters.paymentStatus && {
      key: "paymentStatus",
      tone: "info",
      label: `Payment: ${filters.paymentStatus.replaceAll("_", " ")}`,
      onClear: () => clearFilter("paymentStatus"),
    },
    vendor && {
      key: "vendor",
      tone: "accent",
      label: `Vendor: ${vendor.businessName}`,
      onClear: () => clearFilter("vendorId"),
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
    navigate("/invoices");
  }

  const openDetail = React.useCallback(async (id: string) => {
    setSheetOpen(true);
    setLoadingDetail(true);
    setDetail(null);
    const d = await getInvoiceById(id);
    setDetail(d);
    setLoadingDetail(false);
  }, []);

  const columns: DataTableColumn<InvoiceListRow>[] = React.useMemo(() => [
    {
      id: "id",
      header: "Invoice #",
      cell: (r) => (
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={() => void openDetail(r.id)}
        >
          {r.invoiceNumber}
        </button>
      ),
    },
    {
      id: "po",
      header: "Purchase order",
      cell: (r) => <ProcurementRefLink id={r.poId} className="font-medium" />,
    },
    { id: "vendor", header: "Vendor", cell: (r) => r.vendorName },
    {
      id: "grns",
      header: "Receipts",
      cell: (r) =>
        formatGrnReceiptsSummary(
          r.grnReceiptDates.map((receivedAt) => ({ receivedAt })),
        ),
    },
    {
      id: "amount",
      header: "Amount",
      variant: "numeric",
      cell: (r) => formatInr(r.amount),
    },
    {
      id: "expected",
      header: "Expected",
      variant: "numeric",
      cell: (r) => formatInr(r.expectedAmount),
    },
    {
      id: "match",
      header: "Match",
      cell: (r) => <StatusBadge kind="InvoiceMatchStatus" status={r.matchStatus} />,
    },
    {
      id: "pay",
      header: "Payment",
      cell: (r) => <StatusBadge kind="PaymentStatus" status={r.paymentStatus} />,
    },
    { id: "by", header: "Uploaded by", cell: (r) => r.uploadedByName },
    { id: "on", header: "Date", variant: "date", cell: (r) => formatDateTimeMedium(r.createdAt) },
  ], [openDetail]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={listBreadcrumbs("/invoices")}
        title="Invoices"
        subtitle="Upload invoices, link GRNs, and track three-way match status."
        action={
          canUpload ? (
            <Button render={<Link href="/invoices/new" />}>Upload invoice</Button>
          ) : undefined
        }
      />

      <form method="get" onSubmit={handleFilterSubmit}>
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
            name="matchStatus"
            defaultValue={filters.matchStatus}
            placeholder="All match"
            ariaLabel="Match status"
            triggerClassName="w-[160px]"
            options={Object.values(InvoiceMatchStatus).map((s) => ({
              value: s,
              label: s.replaceAll("_", " "),
            }))}
          />
          <FilterSelect
            name="paymentStatus"
            defaultValue={filters.paymentStatus}
            placeholder="All payment"
            ariaLabel="Payment status"
            triggerClassName="w-[160px]"
            options={Object.values(PaymentStatus).map((s) => ({
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
          title="No invoices found"
          description="No invoices match these filters."
          action={
            canUpload ? (
              <Link href="/invoices/new" className={cn(buttonVariants({ variant: "outline" }))}>
                Upload invoice
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable columns={columns} data={rows.items} getRowKey={getRowId} />
          <Pagination
            basePath="/invoices"
            page={rows.page}
            pageSize={rows.pageSize}
            total={rows.total}
            totalPages={rows.totalPages}
            hasNextPage={rows.hasNextPage}
            onPageChange={handlePageChange}
            searchParams={{
              matchStatus: filters.matchStatus || undefined,
              paymentStatus: filters.paymentStatus || undefined,
              vendorId: filters.vendorId || undefined,
              poId: filters.poId || undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
            }}
          />
        </>
      )}

      <DetailDrawer
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={detail ? `Invoice ${detail.invoiceNumber}` : "Invoice detail"}
        description={detail?.vendorName ?? "Read-only invoice and match summary."}
      >
        {loadingDetail ? (
          <p className="text-ds-sm text-muted-foreground">Loading…</p>
        ) : detail ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="InvoiceMatchStatus" status={detail.matchStatus} />
              <StatusBadge kind="PaymentStatus" status={detail.paymentStatus} />
            </div>

            <SheetSection title="Summary">
              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm">
                <div className="col-span-2">
                  <dt className="text-ds-xs text-muted-foreground">PO</dt>
                  <dd>
                    <ProcurementRefLink id={detail.poId} className="font-medium" />
                  </dd>
                </div>
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Invoice number</dt>
                  <dd className="font-mono text-ds-xs">{detail.invoiceNumber}</dd>
                </div>
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Amount</dt>
                  <dd className="font-semibold tabular-nums">{formatInr(detail.amount)}</dd>
                </div>
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Expected</dt>
                  <dd className="tabular-nums">{formatInr(detail.expectedAmount)}</dd>
                </div>
                {detail.variancePct != null ? (
                  <div>
                    <dt className="text-ds-xs text-muted-foreground">Variance</dt>
                    <dd className="tabular-nums">
                      {formatInr(String(detail.variance))} ({detail.variancePct.toFixed(1)}%)
                    </dd>
                  </div>
                ) : (
                  <div className="col-span-2 text-ds-xs text-muted-foreground">
                    Cannot verify match — PO unit price not set.
                  </div>
                )}
              </dl>
            </SheetSection>

            <SheetSection title={`GRNs covered (${detail.grns.length})`}>
              <ul className="space-y-1.5 text-ds-sm">
                {detail.grns.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-card px-3 py-2"
                  >
                    <span className="truncate">
                      {formatGrnReceiptLabel(detail.poId, g.receivedAt, detail.vendorName)}
                    </span>
                    <span className="shrink-0 text-ds-xs text-muted-foreground">
                      {g.acceptedQty} accepted
                      {g.disputedQty > 0 ? ` · ${g.disputedQty} disputed` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </SheetSection>

            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-card px-3 py-2">
              <div className="min-w-0">
                <p className="text-ds-sm font-medium">Invoice file</p>
                <p className="truncate text-ds-xs text-muted-foreground">
                  {detail.fileSignedUrl
                    ? "Preview the original or download a copy."
                    : "No file uploaded for this invoice."}
                </p>
              </div>
              <DocumentLinks
                url={detail.fileSignedUrl}
                filename={`INV-${detail.invoiceNumber}.pdf`}
              />
            </div>

            {isOps && detail.matchStatus === InvoiceMatchStatus.MISMATCH ? (
              <div className="flex justify-end border-t border-border-subtle pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOverrideId(detail.id)}
                >
                  Override match
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-ds-sm text-muted-foreground">Invoice not found.</p>
        )}
      </DetailDrawer>

      <TextareaActionDialog
        open={overrideId != null}
        onOpenChange={(o) => !o && setOverrideId(null)}
        title="Override invoice match"
        description="Record why this mismatch is accepted. Payment can proceed after override."
        label="Override reason"
        confirmLabel="Override"
        onConfirm={async (text) => {
          if (!overrideId) return;
          const id = overrideId;
          setOverrideId(null);
          const res = await overrideInvoiceMatch(id, text);
          if (res.ok) {
            toast.success("Match override recorded.");
            refresh();
            if (detail?.id === id) {
              const d = await getInvoiceById(id);
              setDetail(d);
            }
          } else {
            toast.error(res.message ?? "Override failed.");
          }
        }}
      />
    </div>
  );
}
