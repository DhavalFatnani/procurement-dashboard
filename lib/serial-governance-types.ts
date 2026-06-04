import type { SerialSeries } from "@/lib/prisma-enums";

import type {
  ReservationEventType,
  SerialRangePhase,
} from "@/lib/serial-series";

/** Unified ledger row for serial activity (print + receipt). */
export type SerialActivityRow = {
  id: string;
  series: SerialSeries;
  rangeStart: string;
  rangeEnd: string;
  quantity: number;
  type: ReservationEventType;
  reservationStatus: "PENDING" | "RESERVED";
  warehouseId: string;
  warehouseName: string;
  linkedPrId: string | null;
  linkedPoId: string | null;
  poStatus: string | null;
  createdByName: string;
  createdAt: string;
};

export type SerialRangeMapStats = {
  totalReserved: number;
  onApprovalHold: number;
  poCancellable: number;
  poCommitted: number;
  internalPrint: number;
  freeInView: number;
  usedPct: number;
};

export type SerialRangeMapSegment = {
  id: string;
  phase: SerialRangePhase;
  rangeStart: string;
  rangeEnd: string;
  quantity: number;
  leftPct: number;
  widthPct: number;
  warehouseId: string;
  warehouseName: string;
  linkedPrId: string | null;
  linkedPoId: string | null;
  poStatus: string | null;
  reservationStatus: "PENDING" | "RESERVED" | null;
  createdByName: string;
  createdAt: string;
  contextTitle: string;
  contextDescription: string;
  actionHint: string | null;
  href: string | null;
};

export type SerialRangeMapData = {
  series: SerialSeries;
  displayName: string;
  seriesStart: string;
  seriesCeiling: string;
  viewStart: string;
  viewEnd: string;
  totalSpan: number;
  segments: SerialRangeMapSegment[];
  stats: SerialRangeMapStats;
};

/** Per-warehouse snapshot for the By warehouse tab. */
export type WarehouseSeriesSnapshot = {
  warehouseId: string;
  warehouseName: string;
  seriesRows: WarehouseSeriesRow[];
};

export type WarehouseSeriesRow = {
  series: SerialSeries;
  displayName: string;
  reservationCount: number;
  lastRangeEnd: string | null;
  lastEventAt: string | null;
  lastEventBy: string | null;
};

/** Ops advanced config — ceiling only in UI. */
export type SeriesConfigSummary = {
  series: SerialSeries;
  displayName: string;
  ceilingNumber: string;
};

/** Global series usage for the Summary tab — informational, not alarming. */
export type SeriesUsageSummary = {
  series: SerialSeries;
  displayName: string;
  prefix: string;
  seriesStart: string;
  lastRangeEnd: string | null;
  nextStart: string;
  reservationCount: number;
  usedPct: number;
  lastEventType: ReservationEventType | null;
  lastEventAt: string | null;
  lastEventBy: string | null;
  warehouseUsage: {
    warehouseId: string;
    warehouseName: string;
    reservationCount: number;
    lastRangeEnd: string | null;
  }[];
};

export type SerialSearchResult = {
  id: string;
  series: SerialSeries;
  seriesName: string;
  rangeStart: string;
  rangeEnd: string;
  createdByName: string;
  createdAt: string;
  prId: string | null;
  poId: string | null;
};
