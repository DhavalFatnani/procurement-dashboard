import type { SerialSeries } from "@/lib/prisma-enums";

import type { SerialRangeMapSegment, SerialRangeMapStats } from "@/lib/serial-governance-types";
import {
  formatSerialNumberForSeries,
  getDefaultSeriesCeiling,
  getSeriesStartNumber,
  reservationPhaseFromReservation,
  resolveSeriesCeiling,
  type SerialRangePhase,
} from "@/lib/serial-series";

export type RawSerialReservationRow = {
  id: string;
  rangeStart: bigint;
  rangeEnd: bigint;
  quantity: number;
  status: "PENDING" | "RESERVED";
  prId: string | null;
  poId: string | null;
  warehouseId: string;
  warehouseName: string;
  createdByName: string;
  createdAt: string;
  poStatus: string | null;
  poHasGrn: boolean;
};

const PHASE_META: Record<
  Exclude<SerialRangePhase, "free">,
  { title: string; description: string; actionHint: string | null }
> = {
  internal_print: {
    title: "Internal print",
    description:
      "Serials reserved for an in-house print job. Numbers are committed on the purchase request.",
    actionHint: "Open the linked PR to view print execution.",
  },
  approval_hold: {
    title: "Approval hold",
    description:
      "Range blocked when Ops approved the vendor lock-tag PR. No PO yet — other approved PRs cannot take these numbers.",
    actionHint: "Create a PO from the PR to commit, or revert approval to release.",
  },
  po_cancellable: {
    title: "Unconfirmed PO",
    description:
      "Committed to an open purchase order before any GRN. Ops can cancel the PO to release serials back to the PR hold.",
    actionHint: "Cancel PO from the purchase order detail page if the order will not proceed.",
  },
  po_committed: {
    title: "Committed",
    description:
      "Linked to a purchase order that has started receiving or is no longer open. Serials stay allocated until closure.",
    actionHint: "Track receipt and invoicing from the PO detail page.",
  },
};

function phaseMeta(phase: Exclude<SerialRangePhase, "free">) {
  return PHASE_META[phase];
}

function segmentHref(input: {
  phase: Exclude<SerialRangePhase, "free">;
  prId: string | null;
  poId: string | null;
}): string | null {
  if (input.poId) {
    return `/purchase-orders/${input.poId}`;
  }
  if (input.prId) {
    return `/purchase-requests/${input.prId}`;
  }
  return null;
}

function computeViewBounds(
  series: SerialSeries,
  ceiling: bigint,
  reservations: RawSerialReservationRow[],
  zoomToActive: boolean,
): { viewStart: bigint; viewEnd: bigint } {
  const seriesStart = getSeriesStartNumber(series);
  if (!zoomToActive || reservations.length === 0) {
    return { viewStart: seriesStart, viewEnd: ceiling };
  }

  const minStart = reservations.reduce(
    (min, row) => (row.rangeStart < min ? row.rangeStart : min),
    reservations[0]!.rangeStart,
  );
  const maxEnd = reservations.reduce(
    (max, row) => (row.rangeEnd > max ? row.rangeEnd : max),
    reservations[0]!.rangeEnd,
  );

  const span = maxEnd - minStart + BigInt(1);
  const padding =
    span > BigInt(10_000) ? span / BigInt(20) : BigInt(2_500);

  let viewStart = minStart > padding ? minStart - padding : seriesStart;
  let viewEnd = maxEnd + padding;
  if (viewStart < seriesStart) {
    viewStart = seriesStart;
  }
  if (viewEnd > ceiling) {
    viewEnd = ceiling;
  }
  return { viewStart, viewEnd };
}

function buildStats(
  segments: SerialRangeMapSegment[],
  totalSpan: bigint,
): SerialRangeMapStats {
  let totalReserved = 0;
  let onApprovalHold = 0;
  let poCancellable = 0;
  let poCommitted = 0;
  let internalPrint = 0;
  let freeInView = 0;

  for (const segment of segments) {
    if (segment.phase === "free") {
      freeInView += segment.quantity;
      continue;
    }
    totalReserved += segment.quantity;
    switch (segment.phase) {
      case "approval_hold":
        onApprovalHold += segment.quantity;
        break;
      case "po_cancellable":
        poCancellable += segment.quantity;
        break;
      case "po_committed":
        poCommitted += segment.quantity;
        break;
      case "internal_print":
        internalPrint += segment.quantity;
        break;
    }
  }

  const spanNum = Number(totalSpan);
  const usedPct = spanNum > 0 ? (totalReserved / spanNum) * 100 : 0;

  return {
    totalReserved,
    onApprovalHold,
    poCancellable,
    poCommitted,
    internalPrint,
    freeInView,
    usedPct,
  };
}

export function buildSerialRangeMap(input: {
  series: SerialSeries;
  displayName: string;
  ceiling?: bigint;
  reservations: RawSerialReservationRow[];
  zoomToActive?: boolean;
}): {
  seriesStart: string;
  seriesCeiling: string;
  viewStart: string;
  viewEnd: string;
  totalSpan: number;
  segments: SerialRangeMapSegment[];
  stats: SerialRangeMapStats;
} {
  const seriesStartNum = getSeriesStartNumber(input.series);
  const ceiling =
    input.ceiling ??
    resolveSeriesCeiling(input.series, getDefaultSeriesCeiling(input.series));
  const sorted = [...input.reservations].sort((a, b) =>
    a.rangeStart < b.rangeStart ? -1 : a.rangeStart > b.rangeStart ? 1 : 0,
  );

  const { viewStart, viewEnd } = computeViewBounds(
    input.series,
    ceiling,
    sorted,
    input.zoomToActive ?? true,
  );
  const totalSpan = viewEnd - viewStart + BigInt(1);
  const totalSpanNum = Number(totalSpan);

  const segments: SerialRangeMapSegment[] = [];
  let cursor = viewStart;

  for (const row of sorted) {
    if (row.rangeEnd < viewStart || row.rangeStart > viewEnd) {
      continue;
    }

    const segStart = row.rangeStart < viewStart ? viewStart : row.rangeStart;
    const segEnd = row.rangeEnd > viewEnd ? viewEnd : row.rangeEnd;

    if (segStart > cursor) {
      const gapQty = Number(segStart - cursor);
      const leftPct = Number((cursor - viewStart) * BigInt(100_000) / totalSpan) / 1000;
      const widthPct = Number((segStart - cursor) * BigInt(100_000) / totalSpan) / 1000;
      segments.push({
        id: `free-${cursor.toString()}`,
        phase: "free",
        rangeStart: formatSerialNumberForSeries(input.series, cursor),
        rangeEnd: formatSerialNumberForSeries(input.series, segStart - BigInt(1)),
        quantity: gapQty,
        leftPct,
        widthPct,
        warehouseId: "",
        warehouseName: "",
        linkedPrId: null,
        linkedPoId: null,
        poStatus: null,
        reservationStatus: null,
        createdByName: "",
        createdAt: "",
        contextTitle: "Available pool",
        contextDescription:
          "No reservation in this band — the next allotment will draw from here when a range is held or committed.",
        actionHint: null,
        href: null,
      });
    }

    const phase = reservationPhaseFromReservation({
      reservationStatus: row.status,
      poId: row.poId,
      prId: row.prId,
      poStatus: row.poStatus,
      poHasGrn: row.poHasGrn,
    });
    const meta = phaseMeta(phase);
    const leftPct = Number((segStart - viewStart) * BigInt(100_000) / totalSpan) / 1000;
    const widthPct = Number((segEnd - segStart + BigInt(1)) * BigInt(100_000) / totalSpan) / 1000;

    segments.push({
      id: row.id,
      phase,
      rangeStart: formatSerialNumberForSeries(input.series, segStart),
      rangeEnd: formatSerialNumberForSeries(input.series, segEnd),
      quantity: Number(segEnd - segStart + BigInt(1)),
      leftPct,
      widthPct,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      linkedPrId: row.prId,
      linkedPoId: row.poId,
      poStatus: row.poStatus,
      reservationStatus: row.status,
      createdByName: row.createdByName,
      createdAt: row.createdAt,
      contextTitle: meta.title,
      contextDescription: meta.description,
      actionHint: meta.actionHint,
      href: segmentHref({ phase, prId: row.prId, poId: row.poId }),
    });

    cursor = segEnd + BigInt(1);
  }

  if (cursor <= viewEnd) {
    const leftPct = Number((cursor - viewStart) * BigInt(100_000) / totalSpan) / 1000;
    const widthPct = Number((viewEnd - cursor + BigInt(1)) * BigInt(100_000) / totalSpan) / 1000;
    segments.push({
      id: `free-${cursor.toString()}-tail`,
      phase: "free",
      rangeStart: formatSerialNumberForSeries(input.series, cursor),
      rangeEnd: formatSerialNumberForSeries(input.series, viewEnd),
      quantity: Number(viewEnd - cursor + BigInt(1)),
      leftPct,
      widthPct,
      warehouseId: "",
      warehouseName: "",
      linkedPrId: null,
      linkedPoId: null,
      poStatus: null,
      reservationStatus: null,
      createdByName: "",
      createdAt: "",
      contextTitle: "Available pool",
      contextDescription:
        "Unallocated numbers after the last reservation in this view.",
      actionHint: null,
      href: null,
    });
  }

  return {
    seriesStart: formatSerialNumberForSeries(input.series, seriesStartNum),
    seriesCeiling: formatSerialNumberForSeries(input.series, ceiling),
    viewStart: formatSerialNumberForSeries(input.series, viewStart),
    viewEnd: formatSerialNumberForSeries(input.series, viewEnd),
    totalSpan: totalSpanNum,
    segments,
    stats: buildStats(segments, totalSpan),
  };
}
