"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  boxShadow: "var(--shadow-2)",
  fontSize: 12,
  color: "var(--text-primary)",
};

export function DashboardPrTrendCard({
  data,
}: {
  data: { day: string; count: number }[];
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <SurfaceCard size="md" className="w-full">
      <SurfaceCardTitle>PR activity — last 7 days</SurfaceCardTitle>
      <SurfaceCardDescription className="mt-1">
        Purchase requests created in your warehouses · {total} this week
      </SurfaceCardDescription>
      <div className="mt-4 h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="prTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--brand-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(d) => d.slice(8)}
              tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--brand-accent)"
              strokeWidth={2}
              fill="url(#prTrendFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SurfaceCard>
  );
}
