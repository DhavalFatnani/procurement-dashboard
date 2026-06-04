import type { PaymentAgePoint, PaymentAgeingExportRow } from "@/lib/queries/reports";
import type { PaymentListRow, PaymentRegisterRow } from "@/lib/queries/payments";
import type {
  AdvancePaymentHistoryRow,
  AdvanceRequestListRow,
} from "@/lib/queries/po-advance";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(headers: readonly string[], rows: string[][]): string {
  const header = headers.join(",");
  const body = rows.map((cells) => cells.map(escapeCsvCell).join(","));
  return [header, ...body].join("\n");
}

export const INVOICE_SETTLEMENT_CSV_HEADERS = [
  "invoice_id",
  "invoice_number",
  "po_id",
  "vendor",
  "invoice_amount_inr",
  "expected_amount_inr",
  "paid_total_inr",
  "cash_paid_inr",
  "advance_allocated_inr",
  "remaining_inr",
  "match_status",
  "payment_status",
  "settled_via",
  "method",
  "transaction_ref",
  "paid_by",
  "paid_at",
] as const;

export function buildInvoiceSettlementCsv(rows: PaymentListRow[]): string {
  return buildCsv(
    INVOICE_SETTLEMENT_CSV_HEADERS,
    rows.map((r) => [
      r.invoiceId,
      r.invoiceNumber,
      r.poId,
      r.vendorName,
      r.invoiceAmount,
      r.expectedAmount ?? "",
      r.paidTotal,
      r.cashPaidOnInvoice,
      r.advanceAllocatedOnInvoice,
      r.remaining,
      r.matchStatus,
      r.paymentStatus,
      r.settledVia,
      r.method ?? "",
      r.transactionRef ?? "",
      r.paidByName ?? "",
      r.paidAt ?? "",
    ]),
  );
}

export const PAYMENT_REGISTER_CSV_HEADERS = [
  "entry_kind",
  "entry_id",
  "date",
  "amount_inr",
  "invoice_id",
  "invoice_number",
  "po_id",
  "vendor",
  "method",
  "transaction_ref",
  "recorded_by",
] as const;

export function buildPaymentRegisterCsv(rows: PaymentRegisterRow[]): string {
  return buildCsv(
    PAYMENT_REGISTER_CSV_HEADERS,
    rows.map((r) => [
      r.kind,
      r.id,
      r.date,
      r.amount,
      r.invoiceId,
      r.invoiceNumber,
      r.poId,
      r.vendorName,
      r.method ?? "",
      r.transactionRef ?? "",
      r.recordedByName ?? "",
    ]),
  );
}

export const VENDOR_ADVANCES_CSV_HEADERS = [
  "section",
  "request_id",
  "payment_id",
  "po_id",
  "vendor",
  "amount_inr",
  "allocated_inr",
  "unallocated_inr",
  "requested_percent",
  "status",
  "method",
  "transaction_ref",
  "requested_by",
  "requested_at",
  "paid_by",
  "paid_at",
  "reason",
] as const;

export function buildVendorAdvancesCsv(
  pending: AdvanceRequestListRow[],
  history: AdvancePaymentHistoryRow[],
): string {
  const pendingRows = pending.map((r) => [
    "pending_request",
    r.id,
    "",
    r.poId,
    r.vendorName,
    r.requestedAmount,
    "",
    "",
    r.requestedPercent ?? "",
    r.status,
    "",
    "",
    r.requestedByName,
    r.requestedAt,
    "",
    "",
    r.reason,
  ]);
  const historyRows = history.map((r) => [
    "payment_history",
    r.requestId,
    r.id,
    r.poId,
    r.vendorName,
    r.amount,
    r.allocated,
    r.unallocated,
    "",
    "FULFILLED",
    r.method ?? "",
    r.transactionRef,
    r.requestedByName,
    r.requestedAt,
    r.paidByName,
    r.paidAt,
    r.reason,
  ]);
  return buildCsv(VENDOR_ADVANCES_CSV_HEADERS, [...pendingRows, ...historyRows]);
}

export const AGEING_SUMMARY_CSV_HEADERS = ["bucket", "invoice_count"] as const;

export const AGEING_DETAIL_CSV_HEADERS = [
  "invoice_number",
  "po_id",
  "vendor",
  "invoice_amount_inr",
  "remaining_inr",
  "age_days",
  "bucket",
] as const;

export function buildAgeingReportCsv(
  summary: PaymentAgePoint[],
  details: PaymentAgeingExportRow[],
): string {
  const summaryBlock = [
    "# summary",
    buildCsv(AGEING_SUMMARY_CSV_HEADERS, summary.map((r) => [r.bucket, String(r.count)])),
    "",
    "# detail",
    buildCsv(
      AGEING_DETAIL_CSV_HEADERS,
      details.map((r) => [
        r.invoiceNumber,
        r.poId,
        r.vendorName,
        r.invoiceAmount,
        r.remaining,
        String(r.ageDays),
        r.bucket,
      ]),
    ),
  ];
  return summaryBlock.join("\n");
}
