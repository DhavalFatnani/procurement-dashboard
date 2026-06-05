"use client";

import { Map, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { SerialRangeMapAdminPanel } from "@/components/admin/SerialRangeMapAdminPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { SurfaceCard } from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { serialRangeMapBreadcrumbs } from "@/lib/lineage";
import type { SerialRangeMapData, SerialRangeMapSegment } from "@/lib/serial-governance-types";
import type { SeriesCode } from "@/lib/series-codes";
import { cn } from "@/lib/utils";

const LEGEND: {
  phase: SerialRangeMapSegment["phase"];
  label: string;
  hint: string;
  swatch: string;
}[] = [
  {
    phase: "approval_hold",
    label: "Approval hold",
    hint: "Blocked at PR approval — awaiting PO",
    swatch: "bg-[var(--status-warning)]",
  },
  {
    phase: "po_cancellable",
    label: "Unconfirmed PO",
    hint: "Open PO, no GRN — Ops can cancel to release",
    swatch: "bg-[var(--status-warning)]/70 ring-2 ring-dashed ring-[var(--status-warning)]",
  },
  {
    phase: "po_committed",
    label: "Committed",
    hint: "PO receiving started or closed",
    swatch: "bg-[var(--status-info)]",
  },
  {
    phase: "internal_print",
    label: "Internal print",
    hint: "In-house barcode print reservation",
    swatch: "bg-[var(--brand-accent)]",
  },
  {
    phase: "admin_block",
    label: "Admin block",
    hint: "Global or warehouse-scoped admin hold",
    swatch: "bg-[var(--status-danger)]",
  },
  {
    phase: "free",
    label: "Available",
    hint: "Unallocated numbers in this view",
    swatch: "bg-muted/50 border border-dashed border-border-subtle",
  },
];

function phaseBarClass(phase: SerialRangeMapSegment["phase"]): string {
  switch (phase) {
    case "approval_hold":
      return "serial-map-segment serial-map-segment--hold bg-[var(--status-warning)]";
    case "po_cancellable":
      return "serial-map-segment serial-map-segment--cancel bg-[var(--status-warning)]/75 ring-1 ring-inset ring-[var(--status-warning)]/60";
    case "po_committed":
      return "serial-map-segment bg-[var(--status-info)]";
    case "internal_print":
      return "serial-map-segment bg-[var(--brand-accent)]";
    case "admin_block":
      return "serial-map-segment bg-[var(--status-danger)] ring-1 ring-inset ring-[var(--status-danger)]/60";
    case "free":
    default:
      return "serial-map-segment bg-muted/35 hover:bg-muted/55 border border-transparent hover:border-border-subtle";
  }
}

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warning" | "info" | "accent" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle px-4 py-3",
        tone === "warning" && "border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)]/40",
        tone === "info" && "border-[var(--status-info)]/25 bg-[var(--status-info-bg)]/40",
        tone === "accent" && "border-[var(--brand-accent)]/20 bg-[var(--accent-subtle)]/50",
        (!tone || tone === "neutral") && "bg-[var(--surface-2)]",
      )}
    >
      <p className="text-ds-2xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-ds-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function SegmentDetail({ segment }: { segment: SerialRangeMapSegment }) {
  return (
    <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-ds-sm font-semibold">{segment.contextTitle}</p>
          <p className="mt-1 font-mono text-ds-xs text-muted-foreground">
            {segment.rangeStart} → {segment.rangeEnd}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-ds-xs font-medium">
          {segment.quantity.toLocaleString("en-IN")}
        </span>
      </div>
      <p className="text-ds-sm leading-relaxed text-muted-foreground">
        {segment.contextDescription}
      </p>
      {segment.warehouseName ? (
        <p className="text-ds-xs text-muted-foreground">
          Warehouse · {segment.warehouseName}
        </p>
      ) : null}
      {segment.createdByName ? (
        <p className="text-ds-xs text-muted-foreground">
          Reserved {formatDateTimeMedium(segment.createdAt)} by {segment.createdByName}
        </p>
      ) : null}
      {(segment.linkedPrId || segment.linkedPoId) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {segment.linkedPrId ? (
            <ProcurementRefLink id={segment.linkedPrId} />
          ) : null}
          {segment.linkedPoId ? (
            <ProcurementRefLink id={segment.linkedPoId} />
          ) : null}
        </div>
      )}
      {segment.actionHint ? (
        <p className="rounded-lg border border-border-subtle bg-muted/30 px-3 py-2 text-ds-xs text-foreground">
          {segment.actionHint}
        </p>
      ) : null}
      {segment.href ? (
        <Button render={<Link href={segment.href} />} variant="soft" size="sm">
          Open linked record
        </Button>
      ) : null}
    </div>
  );
}

export function SerialRangeMapView({
  data,
  seriesOptions,
  initialZoomToActive,
  adminMode = false,
}: {
  data: SerialRangeMapData;
  seriesOptions: { code: SeriesCode; displayName: string }[];
  initialZoomToActive: boolean;
  adminMode?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [zoomToActive, setZoomToActive] = React.useState(initialZoomToActive);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [pinnedId, setPinnedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setZoomToActive(initialZoomToActive);
    setActiveId(null);
    setPinnedId(null);
  }, [initialZoomToActive, data.series, data.viewStart]);

  const reservedSegments = data.segments.filter((s) => s.phase !== "free");
  const displayId = pinnedId ?? activeId;
  const activeSegment =
    data.segments.find((s) => s.id === displayId) ??
    reservedSegments[0] ??
    null;

  function pushParams(next: { series?: SeriesCode; zoom?: "active" | "full" }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.series) {
      params.set("series", next.series);
    }
    if (next.zoom === "full") {
      params.set("zoom", "full");
    } else if (next.zoom === "active") {
      params.delete("zoom");
    }
    const qs = params.toString();
    router.replace(qs ? `/serial-governance/range-map?${qs}` : "/serial-governance/range-map", {
      scroll: false,
    });
  }

  function toggleZoom() {
    const next = !zoomToActive;
    setZoomToActive(next);
    pushParams({ zoom: next ? "active" : "full" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={serialRangeMapBreadcrumbs()}
        title="Serial range map"
        subtitle="Interactive ledger view — hover a band to see lifecycle context, approval holds, and cancellable PO blocks."
        variant="hero"
        action={
          <Button
            render={<Link href="/serial-governance?tab=activity" />}
            variant="soft"
            size="sm"
            className="gap-1.5"
          >
            <Map className="size-3.5" strokeWidth={1.75} aria-hidden />
            Activity ledger
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {seriesOptions.map(({ code, displayName }) => (
          <Button
            key={code}
            type="button"
            size="sm"
            variant={data.series === code ? "default" : "soft"}
            onClick={() => pushParams({ series: code })}
          >
            {displayName}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto gap-1.5"
          onClick={toggleZoom}
        >
          {zoomToActive ? (
            <>
              <ZoomIn className="size-3.5" strokeWidth={1.75} aria-hidden />
              Active region
            </>
          ) : (
            <>
              <ZoomOut className="size-3.5" strokeWidth={1.75} aria-hidden />
              Full pool
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="On approval hold"
          value={data.stats.onApprovalHold.toLocaleString("en-IN")}
          sub="Awaiting PO create"
          tone="warning"
        />
        <StatTile
          label="Cancellable PO"
          value={data.stats.poCancellable.toLocaleString("en-IN")}
          sub="Open, no GRN yet"
          tone="warning"
        />
        <StatTile
          label="Committed"
          value={data.stats.poCommitted.toLocaleString("en-IN")}
          sub="Receiving or closed"
          tone="info"
        />
        <StatTile
          label="Internal print"
          value={data.stats.internalPrint.toLocaleString("en-IN")}
          tone="accent"
        />
        <StatTile
          label="Allocated in view"
          value={`${data.stats.usedPct.toFixed(2)}%`}
          sub={`${data.stats.totalReserved.toLocaleString("en-IN")} of ${data.totalSpan.toLocaleString("en-IN")}`}
        />
      </div>

      <SurfaceCard className="overflow-hidden p-0">
        <div className="border-b border-border-subtle px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-ds-sm font-semibold">{data.displayName}</p>
              <p className="mt-0.5 font-mono text-ds-xs text-muted-foreground">
                Viewing {data.viewStart} — {data.viewEnd}
                <span className="mx-2 text-border-subtle">·</span>
                Pool {data.seriesStart} — {data.seriesCeiling}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {LEGEND.map((item) => (
                <div key={item.phase} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 shrink-0 rounded-sm", item.swatch)} />
                  <span className="text-ds-2xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-8">
          <div
            className="serial-map-track relative h-16 overflow-hidden rounded-2xl border border-border-subtle shadow-inner"
            data-animate="true"
            role="img"
            aria-label={`${data.displayName} serial range map`}
          >
            {data.segments.map((segment, index) => {
              const minWidth = segment.phase === "free" ? 0 : 0.35;
              const widthPct = Math.max(segment.widthPct, minWidth);
              const isActive = displayId === segment.id;
              return (
                <button
                  key={segment.id}
                  type="button"
                  className={cn(
                    "absolute inset-y-1 rounded-md transition-[filter,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    phaseBarClass(segment.phase),
                    isActive && "z-10 brightness-110 ring-2 ring-foreground/25 scale-y-[1.08]",
                    segment.phase !== "free" && "cursor-pointer",
                  )}
                  style={{
                    left: `${segment.leftPct}%`,
                    width: `${widthPct}%`,
                    animationDelay: `${index * 45}ms`,
                  }}
                  title={`${segment.contextTitle}: ${segment.rangeStart}–${segment.rangeEnd}`}
                  onMouseEnter={() => {
                    if (segment.phase !== "free") {
                      setActiveId(segment.id);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!pinnedId) {
                      setActiveId(null);
                    }
                  }}
                  onClick={() => {
                    if (segment.phase === "free") {
                      return;
                    }
                    setPinnedId((prev) => (prev === segment.id ? null : segment.id));
                    setActiveId(segment.id);
                  }}
                  aria-label={`${segment.contextTitle}, ${segment.quantity} numbers`}
                />
              );
            })}
          </div>

          <div className="mt-2 flex justify-between font-mono text-ds-2xs text-muted-foreground">
            <span>{data.viewStart}</span>
            <span>{data.viewEnd}</span>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <SurfaceCard className="p-5">
          <h2 className="text-ds-sm font-semibold">Reserved bands</h2>
          <p className="mt-1 text-ds-xs text-muted-foreground">
            Click a row to pin detail. Hold segments pulse; dashed bands are cancellable POs.
          </p>
          <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
            {reservedSegments.length === 0 ? (
              <li className="py-6 text-center text-ds-sm text-muted-foreground">
                No reservations in this series yet.
              </li>
            ) : (
              reservedSegments.map((segment) => (
                <li key={segment.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      displayId === segment.id
                        ? "bg-[var(--accent-subtle)]"
                        : "hover:bg-muted/50",
                    )}
                    onMouseEnter={() => setActiveId(segment.id)}
                    onClick={() => {
                      setPinnedId(segment.id);
                      setActiveId(segment.id);
                    }}
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", LEGEND.find((l) => l.phase === segment.phase)?.swatch)} />
                    <span className="min-w-0 flex-1 truncate font-mono text-ds-xs">
                      {segment.rangeStart} → {segment.rangeEnd}
                    </span>
                    <span className="shrink-0 text-ds-xs text-muted-foreground">
                      {segment.quantity.toLocaleString("en-IN")}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </SurfaceCard>

        <SurfaceCard className="p-5">
          <h2 className="text-ds-sm font-semibold">Context</h2>
          {activeSegment && activeSegment.phase !== "free" ? (
            <div className="mt-3">
              <SegmentDetail segment={activeSegment} />
              {adminMode ? (
                <SerialRangeMapAdminPanel
                  reservationId={activeSegment.id}
                  rangeLabel={`${activeSegment.rangeStart}–${activeSegment.rangeEnd}`}
                  onDone={() => router.refresh()}
                />
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-ds-sm text-muted-foreground">
              Hover or select a coloured band to see why those serials are blocked and what action
              releases or commits them.
            </p>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
