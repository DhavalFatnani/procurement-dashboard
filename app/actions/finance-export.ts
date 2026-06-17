"use server";

import {
  buildAgeingReportCsv,
  buildInvoiceSettlementCsv,
  buildPaymentRegisterCsv,
  buildVendorAdvancesCsv,
} from "@/lib/finance-export-csv";
import type { PaymentFilters, PaymentRegisterFilters } from "@/lib/queries/payments";
import {
  getPaymentRegister,
  getPayments,
} from "@/lib/queries/payments";
import {
  getAdvancePaymentHistory,
  getPendingAdvanceRequests,
} from "@/lib/queries/po-advance";
import { getPaymentAgeingExportRows, getReports } from "@/lib/queries/reports";
import { requireRoles } from "@/lib/server-action-guard";
import { FINANCE_OR_ADMIN_ROLES } from "@/lib/admin-access";
import { scopeWarehouseIdsForUser } from "@/lib/warehouse-scope";

const EXPORT_PAGE_SIZE = 10_000;

type ExportResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; message: string };

async function requireFinanceExport() {
  const user = await requireRoles([...FINANCE_OR_ADMIN_ROLES]);
  return { user, scopeWarehouseIds: scopeWarehouseIdsForUser(user) };
}

export async function exportInvoiceSettlementCsv(
  filters: PaymentFilters,
): Promise<ExportResult> {
  const { scopeWarehouseIds } = await requireFinanceExport();
  const rows = await getPayments({
    ...filters,
    scopeWarehouseIds,
    page: 1,
    pageSize: EXPORT_PAGE_SIZE,
    includeExactCount: true,
  });

  if (rows.items.length === 0) {
    return { ok: false, message: "No invoices match these filters." };
  }

  const date = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    csv: buildInvoiceSettlementCsv(rows.items),
    filename: `invoice-settlement-${date}.csv`,
  };
}

export async function exportPaymentRegisterCsv(
  filters: PaymentRegisterFilters,
): Promise<ExportResult> {
  const { scopeWarehouseIds } = await requireFinanceExport();
  const rows = await getPaymentRegister({
    ...filters,
    scopeWarehouseIds,
    page: 1,
    pageSize: EXPORT_PAGE_SIZE,
    includeExactCount: true,
  });

  if (rows.items.length === 0) {
    return { ok: false, message: "No payments match these filters." };
  }

  const date = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    csv: buildPaymentRegisterCsv(rows.items),
    filename: `payment-register-${date}.csv`,
  };
}

export async function exportVendorAdvancesCsv(): Promise<ExportResult> {
  const { scopeWarehouseIds } = await requireFinanceExport();
  const [pending, history] = await Promise.all([
    getPendingAdvanceRequests(scopeWarehouseIds),
    getAdvancePaymentHistory(scopeWarehouseIds),
  ]);

  if (pending.length === 0 && history.length === 0) {
    return { ok: false, message: "No vendor advance data to export." };
  }

  const date = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    csv: buildVendorAdvancesCsv(pending, history),
    filename: `vendor-advances-${date}.csv`,
  };
}

export async function exportAgeingReportCsv(): Promise<ExportResult> {
  const { scopeWarehouseIds } = await requireFinanceExport();
  const [reports, details] = await Promise.all([
    getReports(scopeWarehouseIds),
    getPaymentAgeingExportRows(scopeWarehouseIds),
  ]);

  if (details.length === 0 && reports.paymentAge.every((b) => b.count === 0)) {
    return { ok: false, message: "No unpaid invoices to export." };
  }

  const date = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    csv: buildAgeingReportCsv(reports.paymentAge, details),
    filename: `payment-ageing-${date}.csv`,
  };
}
