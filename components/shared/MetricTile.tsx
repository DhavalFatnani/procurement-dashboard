"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Chip } from "@/components/shared/Chip";
import { cn } from "@/lib/utils";

export type MetricTrend = {
  value: number;
  /** "+12.4%" → use a precomputed string here. */
  label?: string;
  /** Overrides direction inference (positive=up). */
  direction?: "up" | "down" | "flat";
  /** When true, downward trends are framed as good (e.g. exceptions). */
  invert?: boolean;
};

/**
 * Headline metric card with optional animated count-up, trend chip, sparkline
 * slot, and icon. Use on Inbox + Dashboard.
 */
export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  iconTone = "neutral",
  trend,
  sparkline,
  prefix,
  suffix,
  formatOptions,
  className,
  href,
  interactive = false,
}: {
  label: string;
  /** When numeric, animates with NumberFlow. Strings render as-is. */
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  iconTone?: "neutral" | "info" | "success" | "warning" | "error" | "accent";
  trend?: MetricTrend;
  /** Optional sparkline element (recharts AreaChart) rendered bottom-right. */
  sparkline?: ReactNode;
  prefix?: string;
  suffix?: string;
  formatOptions?: Format;
  className?: string;
  href?: string;
  interactive?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {hint ? <p className="text-ds-2xs text-muted-foreground/70">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-xl transition-transform duration-fast group-hover:scale-105",
              ICON_TONE[iconTone],
            )}
            aria-hidden
          >
            <Icon className="size-4" strokeWidth={1.5} />
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-ds-metric font-semibold tracking-tight text-foreground tabular-nums">
          {prefix}
          {typeof value === "number" ? (
            <NumberFlow value={value} format={formatOptions} />
          ) : (
            value
          )}
          {suffix}
        </p>
        {trend ? <MetricTrendChip trend={trend} /> : null}
      </div>
      {sparkline ? (
        <div className="-mx-1 -mb-2 h-12 overflow-hidden">{sparkline}</div>
      ) : null}
    </>
  );

  const shellClass = cn(
    "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border-subtle bg-card p-4 shadow-ds",
    "transition-all duration-fast ease-out hover:shadow-ds-2 hover:border-border-default",
    (href || interactive) &&
      "cursor-pointer hover:-translate-y-0.5 hover:surface-glow active:translate-y-0 active:scale-[0.995]",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={shellClass}>
        {inner}
      </Link>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}

const ICON_TONE: Record<NonNullable<Parameters<typeof MetricTile>[0]["iconTone"]>, string> = {
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  error: "bg-[var(--status-error-bg)] text-[var(--status-error)]",
  accent: "bg-[var(--accent-subtle)] text-[var(--brand-accent)]",
};

function MetricTrendChip({ trend }: { trend: MetricTrend }) {
  const direction: "up" | "down" | "flat" =
    trend.direction ??
    (trend.value > 0 ? "up" : trend.value < 0 ? "down" : "flat");

  const tone =
    direction === "flat"
      ? "neutral"
      : trend.invert
        ? direction === "up"
          ? "error"
          : "success"
        : direction === "up"
          ? "success"
          : "error";

  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

  return (
    <Chip tone={tone} size="sm" icon={Icon}>
      {trend.label ?? `${trend.value > 0 ? "+" : ""}${trend.value}%`}
    </Chip>
  );
}
