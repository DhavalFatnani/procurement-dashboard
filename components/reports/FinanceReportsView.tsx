"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckSquare,
  Download,
  HandCoins,
  Receipt,
  Wallet,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { exportAgeingReportCsv } from "@/app/actions/finance-export";
import { Button } from "@/components/ui/button";
import { downloadCsvFile } from "@/lib/download-csv";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { MetricTile } from "@/components/shared/MetricTile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { formatDateMedium, formatInr } from "@/lib/format-datetime";
import type {
  AdvanceLedgerRow,
  FinanceReportsData,
  PaymentAgeingRow,
  RecentSettlementRow,
} from "@/lib/queries/finance-reports";

const SUCCESS = "var(--status-success)";
const WARN = "var(--status-warning)";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  boxShadow: "var(--shadow-2)",
  fontSize: 12,
  color: "var(--text-primary)",
};

function bucketChartData(rows: PaymentAgeingRow[]) {
  const buckets = ["≤7d", "8–14d", "15–30d", "30d+"];
  return buckets.map((bucket) => ({
    bucket,
    count: rows.filter((r) => r.bucket === bucket).length,
  }));
}

const ageingColumns: DataTableColumn<PaymentAgeingRow>[] = [
  {
    id: "invoice",
    header: "Invoice",
    cell: (row) => (
      <Link
        href={row.href}
        className="font-medium text-foreground hover:text-[var(--brand-accent)]"
      >
        {row.invoiceNumber}
      </Link>
    ),
  },
  {
    id: "vendor",
    header: "Vendor",
    cell: (row) => row.vendorName,
  },
  {
    id: "remaining",
    header: "Remaining",
    variant: "numeric",
    cell: (row) => formatInr(row.remaining),
  },
  {
    id: "age",
    header: "Age",
    variant: "numeric",
    cell: (row) => `${row.ageDays}d`,
  },
  {
    id: "bucket",
    header: "Bucket",
    cell: (row) => row.bucket,
  },
];

const ledgerColumns: DataTableColumn<AdvanceLedgerRow>[] = [
  {
    id: "date",
    header: "Date",
    variant: "date",
    cell: (row) => formatDateMedium(row.date),
  },
  {
    id: "kind",
    header: "Type",
    cell: (row) => (row.kind === "payment" ? "Advance paid" : "Allocation"),
  },
  {
    id: "vendor",
    header: "Vendor",
    cell: (row) => row.vendorName,
  },
  {
    id: "po",
    header: "PO",
    variant: "mono",
    cell: (row) => row.poId.slice(-8),
  },
  {
    id: "amount",
    header: "Amount",
    variant: "numeric",
    cell: (row) => (
      <Link href={row.href} className="font-semibold text-foreground hover:text-[var(--brand-accent)]">
        {formatInr(row.amount)}
      </Link>
    ),
  },
];

const settlementColumns: DataTableColumn<RecentSettlementRow>[] = [
  {
    id: "date",
    header: "Date",
    variant: "date",
    cell: (row) => formatDateMedium(row.date),
  },
  {
    id: "kind",
    header: "Type",
    cell: (row) => (row.kind === "cash" ? "Cash" : "Advance"),
  },
  {
    id: "invoice",
    header: "Invoice",
    cell: (row) => (
      <Link
        href={FINANCE_ROUTES.invoiceDetail(row.invoiceId)}
        className="font-medium text-foreground hover:text-[var(--brand-accent)]"
      >
        {row.invoiceNumber}
      </Link>
    ),
  },
  {
    id: "vendor",
    header: "Vendor",
    cell: (row) => row.vendorName,
  },
  {
    id: "amount",
    header: "Amount",
    variant: "numeric",
    cell: (row) => (
      <Link href={row.href} className="font-semibold text-foreground hover:text-[var(--brand-accent)]">
        {formatInr(row.amount)}
      </Link>
    ),
  },
  {
    id: "by",
    header: "Recorded by",
    cell: (row) => row.recordedByName ?? "—",
  },
];

export function FinanceReportsView({
  data,
  onExportAgeingCsv,
}: {
  data: FinanceReportsData;
  onExportAgeingCsv?: () => void;
}) {
  const chartData = bucketChartData(data.paymentAgeing);
  const [exportingAgeing, setExportingAgeing] = React.useState(false);

  const handleExportAgeing = React.useCallback(async () => {
    setExportingAgeing(true);
    const res = await exportAgeingReportCsv();
    setExportingAgeing(false);
    if (!res.ok) {
      toast.error(res.message ?? "Export failed.");
      return;
    }
    downloadCsvFile(res.csv, res.filename);
  }, []);

  const exportAgeingHandler = onExportAgeingCsv ?? (exportingAgeing ? undefined : handleExportAgeing);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricTile
          label="Open invoice value"
          value={formatInr(data.summary.openInvoiceValue)}
          icon={Building2}
          iconTone="warning"
          href={`${FINANCE_ROUTES.invoiceSettlement}?paymentStatus=UNPAID`}
        />
        <MetricTile
          label="Paid MTD"
          value={formatInr(data.summary.paidMtd)}
          icon={Wallet}
          iconTone="success"
          href={FINANCE_ROUTES.paymentRegister}
        />
        <MetricTile
          label="Pending advances"
          value={data.summary.pendingAdvances}
          icon={HandCoins}
          iconTone={data.summary.pendingAdvances > 0 ? "warning" : "neutral"}
          href={FINANCE_ROUTES.vendorAdvances}
        />
        <MetricTile
          label="Invoice match rate"
          value={`${data.summary.matchRate}%`}
          icon={CheckSquare}
          iconTone={data.summary.matchRate >= 95 ? "success" : "warning"}
          href={`${FINANCE_ROUTES.invoiceSettlement}?matchStatus=MISMATCH`}
        />
        <MetricTile
          label="Advance over commitment"
          value={data.summary.overCommitment}
          icon={AlertTriangle}
          iconTone={data.summary.overCommitment > 0 ? "warning" : "success"}
          href="/reports?section=ageing"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="ageing">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Payment ageing</CardTitle>
            {exportAgeingHandler ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportAgeingHandler}
              >
                <Download className="size-3.5" aria-hidden />
                Export CSV
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((row, i) => (
                      <Cell
                        key={row.bucket}
                        fill={i < 2 ? SUCCESS : i === 2 ? WARN : "var(--status-error)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Top vendor exposure</CardTitle>
            <Link
              href={FINANCE_ROUTES.vendorAdvances}
              className="text-ds-xs font-medium text-[var(--brand-accent)] hover:underline"
            >
              View advances
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.vendorExposure.map((v) => {
                const max = data.vendorExposure[0]?.openInvoiceValue ?? 1;
                const pct = max > 0 ? Math.round((v.openInvoiceValue / max) * 100) : 0;
                return (
                  <li key={v.vendorId} className="space-y-1 text-ds-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-foreground">{v.vendorName}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatInr(v.openInvoiceValue)}
                      </span>
                    </div>
                    <span
                      className="block h-1.5 overflow-hidden rounded-full bg-muted"
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--brand-accent)] transition-all duration-slow"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="text-ds-2xs text-muted-foreground">
                      {v.invoiceCount} open invoice{v.invoiceCount === 1 ? "" : "s"}
                      {v.advanceUnallocated > 0
                        ? ` · ${formatInr(v.advanceUnallocated)} advance unallocated`
                        : ""}
                    </span>
                  </li>
                );
              })}
              {data.vendorExposure.length === 0 ? (
                <li className="text-ds-sm text-muted-foreground">No open invoices.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4" strokeWidth={1.5} />
            Payment ageing detail
          </CardTitle>
          <Link
            href={`${FINANCE_ROUTES.invoiceSettlement}?paymentStatus=UNPAID`}
            className="text-ds-xs font-medium text-[var(--brand-accent)] hover:underline"
          >
            Settle invoices
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={ageingColumns}
            data={data.paymentAgeing}
            scrollMaxHeight={false}
            getRowKey={(row) => row.invoiceId}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="size-4" strokeWidth={1.5} />
              Advance ledger
            </CardTitle>
            <Link
              href={FINANCE_ROUTES.vendorAdvances}
              className="text-ds-xs font-medium text-[var(--brand-accent)] hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={ledgerColumns}
              data={data.advanceLedger}
              scrollMaxHeight="320px"
              getRowKey={(row) => `${row.kind}:${row.id}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4" strokeWidth={1.5} />
              Recent settlement activity
            </CardTitle>
            <Link
              href={FINANCE_ROUTES.paymentRegister}
              className="text-ds-xs font-medium text-[var(--brand-accent)] hover:underline"
            >
              Payment register
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={settlementColumns}
              data={data.recentSettlementActivity}
              scrollMaxHeight="320px"
              getRowKey={(row) => `${row.kind}:${row.id}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
