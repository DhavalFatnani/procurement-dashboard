"use client";

import {
  Building2,
  CalendarClock,
  CheckSquare,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MetricTile } from "@/components/shared/MetricTile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr } from "@/lib/format-datetime";
import type { ReportsData } from "@/lib/queries/reports";

const ACCENT = "var(--brand-accent)";
const WARN = "var(--status-warning)";
const SUCCESS = "var(--status-success)";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  boxShadow: "var(--shadow-2)",
  fontSize: 12,
  color: "var(--text-primary)",
};

export function ReportsView({ data }: { data: ReportsData }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="PRs this month"
          value={data.summary.prsThisMonth}
          icon={TrendingUp}
          iconTone="accent"
        />
        <MetricTile
          label="Avg PR → PO"
          value={
            data.summary.avgPrToPoDays != null
              ? `${data.summary.avgPrToPoDays.toFixed(1)}d`
              : "—"
          }
          icon={CalendarClock}
          iconTone="info"
        />
        <MetricTile
          label="Invoice match rate"
          value={`${data.summary.matchRate}%`}
          icon={CheckSquare}
          iconTone={data.summary.matchRate >= 95 ? "success" : "warning"}
        />
        <MetricTile
          label="Open invoice value"
          value={formatInr(String(data.summary.openInvoiceValue))}
          icon={Building2}
          iconTone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>PR creation — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.cycleTime}>
                  <defs>
                    <linearGradient id="cycle" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => d.slice(5)}
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={ACCENT}
                    fill="url(#cycle)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exceptions — open vs total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.exceptionRate}>
                  <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => d.slice(5)}
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="total" stroke={ACCENT} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="open" stroke={WARN} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment ageing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.paymentAge}>
                  <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-secondary)" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.paymentAge.map((row, i) => (
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
          <CardHeader>
            <CardTitle>Top vendors — open PO value</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.topVendors.map((v) => {
                const max = data.topVendors[0]?.openValue ?? 1;
                const pct = max > 0 ? Math.round((v.openValue / max) * 100) : 0;
                return (
                  <li key={v.id} className="space-y-1 text-ds-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-foreground">{v.name}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatInr(String(v.openValue))}
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
                      {v.poCount} open PO{v.poCount === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
              {data.topVendors.length === 0 ? (
                <li className="text-ds-sm text-muted-foreground">No open POs.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
