"use client";

import { canManageFinance } from "@/lib/admin-access";
import { POAdvanceRequestStatus, Role } from "@/lib/prisma-enums";
import * as React from "react";
import { toast } from "sonner";

import {
  getAdvanceRequestDetailForPay,
  recordAdvancePayment,
  rejectAdvanceRequest,
} from "@/app/actions/advance-payments";
import { AdvanceOverageAlert } from "@/components/payments/AdvanceOverageAlert";
import { VendorBankDetailsCard } from "@/components/payments/VendorBankDetailsCard";
import { TextareaActionDialog } from "@/components/shared/TextareaActionDialog";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { Chip } from "@/components/shared/Chip";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { FormDrawer } from "@/components/shared/Drawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { Field } from "@/components/shared/Field";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { SheetSection } from "@/components/shared/SheetSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportVendorAdvancesCsv } from "@/app/actions/finance-export";
import { downloadCsvFile } from "@/lib/download-csv";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import type {
  AdvancePaymentHistoryRow,
  AdvanceRequestDetail,
  AdvanceRequestListRow,
} from "@/lib/queries/po-advance";
import { useListNavigation } from "@/lib/use-list-navigation";

const PAYMENT_METHOD_OPTIONS = [
  { value: "NEFT", label: "NEFT" },
  { value: "RTGS", label: "RTGS" },
  { value: "IMPS", label: "IMPS" },
  { value: "UPI", label: "UPI" },
  { value: "Cheque", label: "Cheque" },
  { value: "Other", label: "Other" },
] as const;

function statusTone(status: POAdvanceRequestStatus): "warning" | "success" | "neutral" | "error" {
  switch (status) {
    case POAdvanceRequestStatus.PENDING:
      return "warning";
    case POAdvanceRequestStatus.FULFILLED:
      return "success";
    case POAdvanceRequestStatus.CANCELLED:
    case POAdvanceRequestStatus.REJECTED:
      return "neutral";
    default:
      return "neutral";
  }
}

export function AdvancePaymentsPanel({
  role,
  rows,
  historyRows,
  initialRequestId,
  onExportCsv,
}: {
  role: Role;
  rows: AdvanceRequestListRow[];
  historyRows: AdvancePaymentHistoryRow[];
  initialRequestId?: string;
  onExportCsv?: () => void;
}) {
  const { refresh } = useListNavigation();
  const isFinance = canManageFinance(role);
  const [exporting, setExporting] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<AdvanceRequestDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [method, setMethod] = React.useState("");
  const [transactionRef, setTransactionRef] = React.useState("");
  const [paidAt, setPaidAt] = React.useState("");
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);

  const openPay = React.useCallback(async (requestId: string) => {
    if (!isFinance) return;
    setSheetOpen(true);
    setLoading(true);
    setLoadFailed(false);
    setDetail(null);
    const d = await getAdvanceRequestDetailForPay(requestId);
    setDetail(d);
    setLoadFailed(!d);
    setMethod("");
    setTransactionRef("");
    setPaidAt("");
    setProofFile(null);
    setLoading(false);
  }, [isFinance]);

  const autoOpenedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!isFinance || !initialRequestId) return;
    if (autoOpenedRef.current === initialRequestId) return;
    autoOpenedRef.current = initialRequestId;
    void openPay(initialRequestId);
  }, [initialRequestId, isFinance, openPay]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (!method) {
      toast.error("Select a payment method.");
      return;
    }
    const fd = new FormData();
    fd.set("requestId", detail.id);
    fd.set("method", method);
    fd.set("transactionRef", transactionRef);
    fd.set("paidAt", paidAt);
    if (proofFile) fd.set("proof", proofFile);

    setSubmitting(true);
    const res = await recordAdvancePayment(fd);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.message ?? "Failed to record advance payment.");
      return;
    }
    toast.success("Advance payment recorded.");
    setSheetOpen(false);
    refresh();
  }

  function handleReject(reason: string) {
    if (!detail) return;
    void (async () => {
      setSubmitting(true);
      const res = await rejectAdvanceRequest(detail.id, reason);
      setSubmitting(false);
      if (!res.ok) {
        toast.error(res.message ?? "Failed to reject advance request.");
        return;
      }
      toast.success("Advance request rejected.");
      setRejectOpen(false);
      setSheetOpen(false);
      refresh();
    })();
  }

  const columns: DataTableColumn<AdvanceRequestListRow>[] = [
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
      id: "amount",
      header: "Requested amount",
      cell: (r) => (
        <span className="font-tabular">
          {formatInr(r.requestedAmount)}
          {r.requestedPercent ? ` (${r.requestedPercent}%)` : ""}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <Chip tone={statusTone(r.status)} size="sm" variant="soft">
          {r.status.replaceAll("_", " ")}
        </Chip>
      ),
    },
    {
      id: "requestedBy",
      header: "Requested by",
      cell: (r) => (
        <span className="text-ds-xs text-muted-foreground">
          {r.requestedByName}
          <span className="block">{formatDateMedium(r.requestedAt)}</span>
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: (r) =>
        isFinance && r.status === POAdvanceRequestStatus.PENDING ? (
          <Button type="button" size="sm" onClick={() => void openPay(r.id)}>
            Pay advance
          </Button>
        ) : null,
    },
  ];

  const historyColumns: DataTableColumn<AdvancePaymentHistoryRow>[] = [
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
      id: "amount",
      header: "Amount paid",
      cell: (r) => <span className="font-tabular">{formatInr(r.amount)}</span>,
    },
    {
      id: "wallet",
      header: "Credit balance",
      cell: (r) => (
        <span className="text-ds-xs text-muted-foreground">
          <span className="block text-foreground">
            Allocated {formatInr(r.allocated)}
          </span>
          Unallocated {formatInr(r.unallocated)}
        </span>
      ),
    },
    {
      id: "method",
      header: "Method",
      cell: (r) => r.method ?? "—",
    },
    {
      id: "txn",
      header: "Transaction ref",
      cell: (r) => <span className="font-mono text-ds-xs">{r.transactionRef}</span>,
    },
    {
      id: "paid",
      header: "Paid",
      cell: (r) => (
        <span className="text-ds-xs text-muted-foreground">
          <span className="block text-foreground">{r.paidByName}</span>
          {formatDateMedium(r.paidAt)}
        </span>
      ),
    },
    {
      id: "requestedBy",
      header: "Requested by",
      cell: (r) => (
        <span className="text-ds-xs text-muted-foreground">
          <span className="block text-foreground">{r.requestedByName}</span>
          {formatDateMedium(r.requestedAt)}
        </span>
      ),
    },
  ];

  const advanceAllocatedOnPo =
    detail != null
      ? Math.max(0, Number(detail.advancePaid) - Number(detail.advanceUnallocated))
      : 0;

  const handleExportCsv = React.useCallback(async () => {
    if (!isFinance) return;
    setExporting(true);
    const res = await exportVendorAdvancesCsv();
    setExporting(false);
    if (!res.ok) {
      toast.error(res.message ?? "Export failed.");
      return;
    }
    downloadCsvFile(res.csv, res.filename);
  }, [isFinance]);

  const exportHandler = isFinance
    ? (onExportCsv ?? (exporting ? undefined : handleExportCsv))
    : undefined;

  return (
    <div className="space-y-6">
      {exportHandler ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={exportHandler}>
            Export CSV
          </Button>
        </div>
      ) : null}
      <SurfaceCard
        header={
          <>
            <SurfaceCardTitle>Pending requests</SurfaceCardTitle>
            <SurfaceCardDescription>
              Ops requests at PO setup — pay the vendor here to create PO advance credit.
            </SurfaceCardDescription>
          </>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No pending advance requests"
            description="When Ops requests an advance at PO configuration, it will appear here for Finance to pay."
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            getRowKey={(r) => r.id}
            onRowClick={
              isFinance
                ? (r) => {
                    void openPay(r.id);
                  }
                : undefined
            }
          />
        )}
      </SurfaceCard>

      <SurfaceCard
        header={
          <>
            <SurfaceCardTitle>Payment history</SurfaceCardTitle>
            <SurfaceCardDescription>
              Vendor advance disbursements and how much credit remains unallocated per payment.
            </SurfaceCardDescription>
          </>
        }
      >
        {historyRows.length === 0 ? (
          <EmptyState
            title="No advance payments recorded yet"
            description="After Finance pays an advance request, the payment will appear here."
          />
        ) : (
          <DataTable
            columns={historyColumns}
            data={historyRows}
            getRowKey={(r) => r.id}
          />
        )}
      </SurfaceCard>

      <FormDrawer
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Pay vendor advance"
        description={
          detail
            ? `${detail.vendorName} · ${formatInr(detail.requestedAmount)} requested`
            : loadFailed
              ? "Request unavailable"
              : "Loading…"
        }
      >
        {loading ? (
          <p className="text-ds-sm text-muted-foreground">Loading request details…</p>
        ) : loadFailed || !detail ? (
          <EmptyState
            title="Request no longer pending"
            description="This advance request may have been paid, rejected, or cancelled. Return to the pending requests list."
          />
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
            {detail.overageWarning ? (
              <AdvanceOverageAlert message={detail.overageWarning} />
            ) : null}
            <SheetSection title="Purchase order">
              <p className="text-ds-sm">
                <ProcurementRefLink id={detail.poId} className="font-medium" />
              </p>
              <dl className="mt-3 grid gap-2 text-ds-sm sm:grid-cols-3">
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Paid</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatInr(detail.advancePaid)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Allocated</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatInr(advanceAllocatedOnPo)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ds-xs text-muted-foreground">Unallocated</dt>
                  <dd className="font-semibold tabular-nums text-[var(--status-warning)]">
                    {formatInr(detail.advanceUnallocated)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-ds-xs text-muted-foreground">
                Committed PO value {formatInr(detail.committedTotal)}
              </p>
              <p className="mt-2 text-ds-sm text-muted-foreground">{detail.reason}</p>
            </SheetSection>

            <VendorBankDetailsCard
              vendorName={detail.vendorName}
              bank={detail.vendorBank}
              transferAmount={Number(detail.requestedAmount)}
              description="Pay the vendor advance to this account. Confirm the details match your records before recording payment."
            />

            <SheetSection title="Payment">
              <p className="mb-3 text-ds-sm">
                Pay exactly{" "}
                <span className="font-semibold font-tabular">
                  {formatInr(detail.requestedAmount)}
                </span>
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Method" htmlFor="adv-method">
                  <Select value={method || undefined} onValueChange={setMethod}>
                    <SelectTrigger id="adv-method" className="h-9">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Paid date" htmlFor="adv-paid-at">
                  <Input
                    id="adv-paid-at"
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Transaction reference" htmlFor="adv-txn" className="sm:col-span-2">
                  <Input
                    id="adv-txn"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Proof (optional)" htmlFor="adv-proof" className="sm:col-span-2">
                  <Input
                    id="adv-proof"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  />
                </Field>
              </div>
            </SheetSection>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setRejectOpen(true)}
              >
                Reject request
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Record advance payment"}
              </Button>
            </div>
          </form>
        )}
      </FormDrawer>

      <TextareaActionDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject advance request"
        description="Ops will see this reason on the PO. The request cannot be paid after rejection."
        label="Rejection reason"
        placeholder="Why Finance is not paying this advance"
        confirmLabel="Reject"
        pending={submitting}
        onConfirm={handleReject}
      />
    </div>
  );
}
