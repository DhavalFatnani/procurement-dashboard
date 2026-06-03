import type { SerialSeries } from "@/lib/prisma-enums";

import type { ReservationEventType } from "@/lib/serial-series";

/** Unified ledger row for serial activity (print + receipt). */
export type SerialActivityRow = {
  id: string;
  series: SerialSeries;
  rangeStart: string;
  rangeEnd: string;
  quantity: number;
  type: ReservationEventType;
  warehouseId: string;
  warehouseName: string;
  linkedPrId: string | null;
  linkedPoId: string | null;
  createdByName: string;
  createdAt: string;
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
