"use client";

import { InvoiceMatchStatus, PaymentStatus, Role } from "@/lib/prisma-enums";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, FileText } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { InvoicePaymentDetail, PaymentListRow } from "@/lib/queries/payments";
import { getInvoicePaymentDetail, recordPayment } from "@/app/actions/payments";
import { Chip } from "@/components/shared/Chip";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { FormDrawer } from "@/components/shared/Drawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { Field } from "@/components/shared/Field";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { FilterSearch } from "@/components/shared/FilterSearch";
import { FilterSelect } from "@/components/shared/FilterSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { ProgressRing } from "@/components/shared/ProgressRing";
import { SheetSection } from "@/components/shared/SheetSection";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import { listBreadcrumbs } from "@/lib/lineage";
import {
  formatGrnReceiptsSummary,
  formatProcurementRef,
} from "@/lib/display-ref";
import type { Paginated } from "@/lib/pagination";
import { useListNavigation } from "@/lib/use-list-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";

const getPaymentRowKey = (r: PaymentListRow) => r.invoiceId;

/** Bank channels supported for vendor disbursement. */
const PAYMENT_METHOD_OPTIONS = [
  { value: "NEFT", label: "NEFT" },
  { value: "RTGS", label: "RTGS" },
  { value: "IMPS", label: "IMPS" },
  { value: "UPI", label: "UPI" },
  { value: "Cheque", label: "Cheque" },
  { value: "Cash", label: "Cash" },
  { value: "Other", label: "Other" },
] as const;

function resetPaymentForm(
  setAmount: (v: string) => void,
  setMethod: (v: string) => void,
  setTransactionRef: (v: string) => void,
  setPaidAt: (v: string) => void,
  setProofFile: (v: File | null) => void,
) {
  setAmount("");
  setMethod("");
  setTransactionRef("");
  setPaidAt("");
  setProofFile(null);
}

type PaymentsFilters = {
  paymentStatus: string;
  matchStatus: string;
  vendorId: string;
  poId: string;
  dateFrom: string;
  dateTo: string;
};

type FilterScalarKey = keyof PaymentsFilters;

export function PaymentsView({
  role,
  initialRows,
  filters,
  filterOptions,
  initialInvoiceId,
}: {
  role: Role;
  initialRows: Paginated<PaymentListRow>;
  filters: PaymentsFilters;
  filterOptions: { vendors: { id: string; businessName: string }[] };
  /** When set (typically from inbox deep-links), auto-open the drawer for this invoice. */
  initialInvoiceId?: string;
}) {
  const searchParams = useSearchParams();
  const { navigate, refresh } = useListNavigation();
  const isFinance = role === Role.FINANCE;
  const rows = initialRows;
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<InvoicePaymentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [transactionRef, setTransactionRef] = React.useState("");
  const [paidAt, setPaidAt] = React.useState("");
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const paymentFormRef = React.useRef<HTMLFormElement>(null);

  const paymentGated =
    detail?.matchStatus === InvoiceMatchStatus.MISMATCH && !detail.overrideReason;

  const setFilter = React.useCallback(
    (key: FilterScalarKey, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      params.delete("invoiceId");
      const qs = params.toString();
      navigate(qs ? `/payments?${qs}` : "/payments");
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
    navigate("/payments");
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    if (page > 1) params.set("exactCount", "1");
    params.delete("invoiceId");
    const qs = params.toString();
    navigate(qs ? `/payments?${qs}` : "/payments");
  }

  const loadDetail = React.useCallback(async (invoiceId: string) => {
    const d = await getInvoicePaymentDetail(invoiceId);
    setDetail(d);
    if (d) {
      setAmount(d.remaining);
      setMethod("");
      setTransactionRef("");
      setPaidAt("");
      setProofFile(null);
    }
    return d;
  }, []);

  const openPaymentSheet = React.useCallback(
    async (invoiceId: string) => {
      if (!isFinance) {
        return;
      }
      setSheetOpen(true);
      setLoadingDetail(true);
      setDetail(null);
      await loadDetail(invoiceId);
      setLoadingDetail(false);
    },
    [isFinance, loadDetail],
  );

  // Auto-open the drawer when an inbox deep-link supplies `?invoiceId=...`.
  // Uses a ref so we don't re-open after the user has closed it manually.
  const autoOpenedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!isFinance) return;
    if (!initialInvoiceId) return;
    if (autoOpenedRef.current === initialInvoiceId) return;
    autoOpenedRef.current = initialInvoiceId;
    void openPaymentSheet(initialInvoiceId);
  }, [initialInvoiceId, isFinance, openPaymentSheet]);

  const handleRowClick = React.useCallback(
    (r: PaymentListRow) => {
      if (r.paymentStatus !== PaymentStatus.PAID) {
        void openPaymentSheet(r.invoiceId);
      }
    },
    [openPaymentSheet],
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (!method) {
      toast.error("Select a payment method.");
      return;
    }
    const fd = new FormData();
    fd.set("invoiceId", detail.invoiceId);
    fd.set("amount", amount);
    fd.set("method", method);
    fd.set("transactionRef", transactionRef);
    fd.set("paidAt", paidAt);
    if (proofFile) fd.set("proof", proofFile);

    setSubmitting(true);
    const res = await recordPayment(fd);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.message ?? "Failed to record payment.");
      return;
    }
    toast.success("Payment recorded.");
    const updated = await loadDetail(detail.invoiceId);
    refresh();
    if (updated?.paymentStatus === PaymentStatus.PAID) {
      setSheetOpen(false);
      resetPaymentForm(setAmount, setMethod, setTransactionRef, setPaidAt, setProofFile);
    }
  }

  const columns: DataTableColumn<PaymentListRow>[] = React.useMemo(() => {
    const invoiceCol: DataTableColumn<PaymentListRow> = {
      id: "invoice",
      header: "Invoice #",
      cell: (r) =>
        isFinance ? (
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => void openPaymentSheet(r.invoiceId)}
          >
            {r.invoiceNumber}
          </button>
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
            <span
              className="h-1 w-28 overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
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
      const receiptsCol: DataTableColumn<PaymentListRow> = {
        id: "receipts",
        header: "Receipts",
        cell: (r) =>
          formatGrnReceiptsSummary(
            r.grnReceiptDates.map((d) => ({ receivedAt: d })),
          ),
      };

      const expectedCol: DataTableColumn<PaymentListRow> = {
        id: "expected",
        header: "Expected",
        variant: "numeric",
        cell: (r) => (r.expectedAmount ? formatInr(r.expectedAmount) : "—"),
      };

      const uploadedByCol: DataTableColumn<PaymentListRow> = {
        id: "uploadedBy",
        header: "Uploaded by",
        cell: (r) => r.uploadedByName,
      };

      const latestCol: DataTableColumn<PaymentListRow> = {
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
      };

      const actionsCol: DataTableColumn<PaymentListRow> = {
        id: "actions",
        header: "Actions",
        cell: (r) =>
          r.paymentStatus === PaymentStatus.PAID ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              onClick={(e) => {
                e.stopPropagation();
                void openPaymentSheet(r.invoiceId);
              }}
            >
              {r.paymentStatus === PaymentStatus.PARTIALLY_PAID ? "Add payment" : "Record"}
            </Button>
          ),
      };

      return [
        invoiceCol,
        poCol,
        vendorCol,
        receiptsCol,
        amountCol,
        expectedCol,
        matchCol,
        paymentCol,
        uploadedByCol,
        latestCol,
        actionsCol,
      ];
    }

    // Ops (read-only) — original column set.
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
  }, [isFinance, openPaymentSheet]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={listBreadcrumbs("/payments")}
        title={isFinance ? "Invoices & payments" : "Payments"}
        subtitle={
          isFinance
            ? "Browse every invoice and record payments in one place. Partial payments can be split across multiple transactions."
            : "Read-only payment status across invoices."
        }
      />

      <FilterBar
        resultCount={rows.total ?? undefined}
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
            basePath="/payments"
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

      {isFinance ? (
        <FormDrawer
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={detail ? `Invoice ${detail.invoiceNumber}` : "Invoice details"}
          description={detail?.vendorName}
          footer={
            detail && Number(detail.remaining) > 0 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSheetOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  disabled={submitting || paymentGated}
                  onClick={() => paymentFormRef.current?.requestSubmit()}
                >
                  {submitting ? "Saving…" : "Record payment"}
                </Button>
              </>
            ) : detail ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
              >
                Close
              </Button>
            ) : null
          }
        >
          {loadingDetail ? (
            <p className="text-ds-sm text-muted-foreground">Loading…</p>
          ) : detail ? (
            <form
              ref={paymentFormRef}
              data-submit-shortcut
              onSubmit={handleSave}
              className="space-y-5"
            >
              {paymentGated ? (
                <div className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-ds-sm text-[var(--status-error)]">
                  Payment is gated — invoice has a match mismatch. An Ops Head override is
                  required before you can record a payment.
                </div>
              ) : null}

              <SheetSection
                title="Invoice details"
                description="Read-only audit context for this invoice."
              >
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm">
                  <DetailRow label="Purchase order">
                    <ProcurementRefLink id={detail.poId} className="font-medium" />
                  </DetailRow>
                  <DetailRow label="Invoice date">
                    {formatDateMedium(detail.invoiceDate)}
                  </DetailRow>
                  <DetailRow label="Uploaded by">
                    {detail.uploadedByName}
                  </DetailRow>
                  <DetailRow label="Uploaded on">
                    {formatDateMedium(detail.createdAt)}
                  </DetailRow>
                  <DetailRow label="Amount">
                    <span className="font-semibold tabular-nums">
                      {formatInr(detail.amount)}
                    </span>
                  </DetailRow>
                  <DetailRow label="Expected">
                    {detail.expectedAmount ? (
                      <span className="font-semibold tabular-nums">
                        {formatInr(detail.expectedAmount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </DetailRow>
                  {detail.variance != null ? (
                    <DetailRow label="Variance" wide>
                      <span
                        className={
                          detail.variance === 0
                            ? "text-status-success"
                            : "text-status-warning"
                        }
                      >
                        {formatInr(String(detail.variance))}
                        {detail.variancePct != null
                          ? ` (${detail.variancePct.toFixed(1)}%)`
                          : ""}
                      </span>
                    </DetailRow>
                  ) : null}
                  {detail.overrideReason ? (
                    <DetailRow label="Override reason" wide>
                      <span className="text-ds-xs text-muted-foreground">
                        {detail.overrideReason}
                      </span>
                    </DetailRow>
                  ) : null}
                </dl>
                {detail.grns.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm">
                    <p className="mb-2 text-ds-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Linked goods receipts ({detail.grns.length})
                    </p>
                    <ul className="space-y-1.5">
                      {detail.grns.map((g) => (
                        <li
                          key={g.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <span>{formatDateMedium(g.receivedAt)}</span>
                          <span className="text-ds-xs text-muted-foreground">
                            {g.acceptedQty} accepted
                            {g.disputedQty > 0
                              ? ` · ${g.disputedQty} disputed`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {detail.fileSignedUrl ? (
                  <a
                    href={detail.fileSignedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-ds-xs text-primary hover:underline"
                  >
                    <FileText className="size-3.5" strokeWidth={1.5} aria-hidden />
                    View invoice file
                  </a>
                ) : null}
              </SheetSection>

              <section className="flex items-start gap-4 rounded-xl border border-border-subtle bg-card p-4 text-ds-sm">
                <ProgressRing
                  value={Number(detail.paidTotal)}
                  total={Number(detail.amount)}
                  size={64}
                  strokeWidth={6}
                  tone={
                    Number(detail.remaining) === 0
                      ? "success"
                      : detail.paymentStatus === PaymentStatus.PARTIALLY_PAID
                        ? "warning"
                        : "accent"
                  }
                  label={
                    <span className="text-ds-2xs font-semibold">
                      {Number(detail.amount) > 0
                        ? `${Math.round((Number(detail.paidTotal) / Number(detail.amount)) * 100)}%`
                        : "0%"}
                    </span>
                  }
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-foreground">Payment summary</p>
                  <p>
                    <span className="text-muted-foreground">Invoice:</span>{" "}
                    <span className="font-semibold tabular-nums">
                      {formatInr(detail.amount)}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Paid:</span>{" "}
                    <span className="font-semibold tabular-nums text-[var(--status-success)]">
                      {formatInr(detail.paidTotal)}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Remaining:</span>{" "}
                    <span className="font-semibold tabular-nums text-[var(--status-warning)]">
                      {formatInr(detail.remaining)}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <StatusBadge kind="InvoiceMatchStatus" status={detail.matchStatus} />
                    <StatusBadge kind="PaymentStatus" status={detail.paymentStatus} />
                    {detail.expectedAmount &&
                    Number(detail.amount) !== Number(detail.expectedAmount) ? (
                      <Chip tone="warning" size="sm">
                        Expected {formatInr(detail.expectedAmount)}
                      </Chip>
                    ) : null}
                  </div>
                </div>
              </section>

              {detail.payments.length > 0 ? (
                <SheetSection title="Payment history">
                  <ol className="space-y-2">
                    {detail.payments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-start gap-3 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm"
                      >
                        <span
                          className="mt-1 size-2 shrink-0 rounded-full bg-[var(--status-success)]"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-semibold tabular-nums text-foreground">
                              {formatInr(p.amount)}
                            </span>
                            <span className="text-ds-xs text-muted-foreground">
                              {formatDateMedium(p.paidAt)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-ds-xs text-muted-foreground">
                            <span>
                              Txn{" "}
                              <span className="font-mono text-foreground">
                                {p.transactionRef ?? "—"}
                              </span>
                            </span>
                            {p.method ? <span>· {p.method}</span> : null}
                            {p.paidByName ? <span>· {p.paidByName}</span> : null}
                          </div>
                          {p.proofSignedUrl ? (
                            <a
                              href={p.proofSignedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-ds-xs text-primary hover:underline"
                            >
                              View proof →
                            </a>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </SheetSection>
              ) : null}

              <SheetSection
                title="Bank details verification"
                description="Verify these details match the invoice before recording payment."
              >
                <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border-subtle bg-card p-3 text-ds-sm">
                  <div>
                    <dt className="text-ds-xs text-muted-foreground">Account name</dt>
                    <dd className="font-medium">{detail.vendorBank.accountName}</dd>
                  </div>
                  <div>
                    <dt className="text-ds-xs text-muted-foreground">Account</dt>
                    <dd className="font-mono">••••{detail.vendorBank.accountLast4}</dd>
                  </div>
                  <div>
                    <dt className="text-ds-xs text-muted-foreground">IFSC</dt>
                    <dd className="font-mono">{detail.vendorBank.ifsc}</dd>
                  </div>
                  <div>
                    <dt className="text-ds-xs text-muted-foreground">Bank</dt>
                    <dd>{detail.vendorBank.bankName}</dd>
                  </div>
                </dl>
              </SheetSection>

              {Number(detail.remaining) > 0 ? (
                <SheetSection
                  title={
                    detail.paymentStatus === PaymentStatus.PARTIALLY_PAID
                      ? "Add another payment"
                      : "Record payment"
                  }
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Amount"
                      htmlFor="payment-amount"
                      hint={`Up to ${formatInr(detail.remaining)} remaining`}
                      required
                    >
                      <Input
                        id="payment-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={detail.remaining}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={paymentGated}
                        required
                      />
                    </Field>
                    <Field label="Payment method" htmlFor="payment-method" required>
                      <Select
                        value={method}
                        onValueChange={setMethod}
                        disabled={paymentGated}
                      >
                        <SelectTrigger
                          id="payment-method"
                          aria-label="Payment method"
                        >
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHOD_OPTIONS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      label="Transaction reference"
                      htmlFor="payment-txn"
                      className="sm:col-span-2"
                      required
                    >
                      <Input
                        id="payment-txn"
                        placeholder="Reference number from the bank"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        disabled={paymentGated}
                        required
                      />
                    </Field>
                    <Field label="Paid date" htmlFor="payment-paid-at" required>
                      <Input
                        id="payment-paid-at"
                        type="date"
                        value={paidAt}
                        onChange={(e) => setPaidAt(e.target.value)}
                        disabled={paymentGated}
                        required
                      />
                    </Field>
                    <Field label="Proof" htmlFor="payment-proof" hint="PDF or image">
                      <Input
                        id="payment-proof"
                        type="file"
                        accept=".pdf,image/*"
                        disabled={paymentGated}
                        onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                      />
                    </Field>
                  </div>
                </SheetSection>
              ) : null}
            </form>
          ) : null}
        </FormDrawer>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-ds-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
