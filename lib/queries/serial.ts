import { Prisma, SerialSeries } from "@prisma/client";

import { getCachedSeriesConfigs, getCachedWarehouses } from "@/lib/cache";
import { dbParallel } from "@/lib/db-parallel";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type {
  SerialActivityRow,
  SerialSearchResult,
  SeriesConfigSummary,
  SeriesUsageSummary,
  WarehouseSeriesRow,
  WarehouseSeriesSnapshot,
} from "@/lib/serial-governance-types";
import {
  computeNextRangeStart,
  computeRangeUsedPct,
  formatSerialNumber,
  formatSerialNumberForSeries,
  getDefaultSeriesCeiling,
  getSeriesDisplayName,
  getSeriesPrefix,
  getSeriesStartNumber,
  parseSerialBigInt,
  reservationEventType,
  resolveSeriesCeiling,
  SERIAL_SERIES_ORDER,
  validReservationsForSeriesWhere,
  validReservationsUnionWhere,
  type ReservationEventType,
} from "@/lib/serial-series";

export type {
  SerialActivityRow,
  SerialSearchResult,
  SeriesConfigSummary,
  SeriesUsageSummary,
  WarehouseSeriesRow,
  WarehouseSeriesSnapshot,
} from "@/lib/serial-governance-types";

export type SerialActivityFilters = {
  series?: SerialSeries;
  type?: ReservationEventType;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

function buildSerialActivityWhere(filters: SerialActivityFilters): Prisma.SerialReservationWhereInput {
  const clauses: Prisma.SerialReservationWhereInput[] = [];
  if (filters.series) {
    clauses.push({ series: filters.series });
  }
  if (filters.warehouseId) {
    clauses.push({ warehouseId: filters.warehouseId });
  }
  if (filters.type === "Receipt") {
    clauses.push({ poId: { not: null } });
  } else if (filters.type === "Print") {
    clauses.push({ prId: { not: null }, poId: null });
  }
  if (filters.dateFrom) {
    clauses.push({ createdAt: { gte: new Date(filters.dateFrom) } });
  }
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    clauses.push({ createdAt: { lte: end } });
  }
  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function getSerialActivity(
  filters: SerialActivityFilters,
): Promise<Paginated<SerialActivityRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const where = buildSerialActivityWhere(filters);

  return paginatedListQuery({
    page,
    pageSize,
    includeExactCount: filters.includeExactCount,
    findMany: ({ skip, take }) =>
      prisma.serialReservation
        .findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            series: true,
            rangeStart: true,
            rangeEnd: true,
            quantity: true,
            prId: true,
            poId: true,
            warehouseId: true,
            createdAt: true,
            createdBy: { select: { name: true } },
            warehouse: { select: { name: true } },
          },
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            series: r.series,
            rangeStart: formatSerialNumberForSeries(r.series, r.rangeStart),
            rangeEnd: formatSerialNumberForSeries(r.series, r.rangeEnd),
            quantity: r.quantity,
            type: reservationEventType(r.poId, r.prId),
            warehouseId: r.warehouseId,
            warehouseName: r.warehouse.name,
            linkedPrId: r.prId,
            linkedPoId: r.poId,
            createdByName: r.createdBy.name,
            createdAt: r.createdAt.toISOString(),
          })),
        ),
    count: () => prisma.serialReservation.count({ where }),
  });
}

export async function getSeriesUsageSummary(): Promise<SeriesUsageSummary[]> {
  const [configs, warehouses] = await dbParallel(
    () => getCachedSeriesConfigs(),
    () => getCachedWarehouses(),
  );
  const configBySeries = new Map(configs.map((c) => [c.series, c]));
  const warehouseById = new Map(warehouses.map((w) => [w.id, w.name]));

  return Promise.all(
    SERIAL_SERIES_ORDER.map(async (series) => {
      const validWhere = validReservationsForSeriesWhere(series);
      const config = configBySeries.get(series);
      const ceiling = resolveSeriesCeiling(
        series,
        config ? BigInt(config.ceilingNumber) : undefined,
      );
      const seriesStart = getSeriesStartNumber(series);

      const [agg, warehouseGrouped, latest] = await dbParallel(
        () =>
          prisma.serialReservation.aggregate({
            where: validWhere,
            _count: { _all: true },
            _max: { rangeEnd: true },
          }),
        () =>
          prisma.serialReservation.groupBy({
            by: ["warehouseId"],
            where: validWhere,
            _count: { _all: true },
            _max: { rangeEnd: true },
          }),
        () =>
          prisma.serialReservation.findFirst({
            where: validWhere,
            orderBy: { createdAt: "desc" },
            select: {
              createdAt: true,
              poId: true,
              prId: true,
              createdBy: { select: { name: true } },
            },
          }),
      );

      const lastEnd = agg._max.rangeEnd ?? null;
      const nextStart = computeNextRangeStart(series, lastEnd);

      const warehouseUsage = warehouseGrouped
        .map((g) => ({
          warehouseId: g.warehouseId,
          warehouseName: warehouseById.get(g.warehouseId) ?? g.warehouseId,
          reservationCount: g._count._all,
          lastRangeEnd:
            g._max.rangeEnd != null
              ? formatSerialNumberForSeries(series, g._max.rangeEnd)
              : null,
        }))
        .sort((a, b) => b.reservationCount - a.reservationCount);

      return {
        series,
        displayName: getSeriesDisplayName(series),
        prefix: getSeriesPrefix(series),
        seriesStart: formatSerialNumberForSeries(series, seriesStart),
        lastRangeEnd:
          lastEnd != null ? formatSerialNumberForSeries(series, lastEnd) : null,
        nextStart: formatSerialNumberForSeries(series, nextStart),
        reservationCount: agg._count._all,
        usedPct: computeRangeUsedPct(series, lastEnd, ceiling),
        lastEventType: latest
          ? reservationEventType(latest.poId, latest.prId)
          : null,
        lastEventAt: latest?.createdAt.toISOString() ?? null,
        lastEventBy: latest?.createdBy.name ?? null,
        warehouseUsage,
      };
    }),
  );
}

export async function getWarehouseSeriesSnapshot(options?: {
  ensureWarehouseIds?: string[];
}): Promise<WarehouseSeriesSnapshot[]> {
  const warehouses = await getCachedWarehouses();
  const warehouseById = new Map(warehouses.map((w) => [w.id, w.name]));

  const grouped = await prisma.serialReservation.groupBy({
    by: ["series", "warehouseId"],
    where: validReservationsUnionWhere(),
    _count: { _all: true },
    _max: { rangeEnd: true },
  });

  const latestRows = await prisma.serialReservation.findMany({
    where: validReservationsUnionWhere(),
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      series: true,
      warehouseId: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });

  const latestByKey = new Map<string, (typeof latestRows)[number]>();
  for (const row of latestRows) {
    const key = `${row.series}:${row.warehouseId}`;
    if (!latestByKey.has(key)) {
      latestByKey.set(key, row);
    }
  }

  const statsByKey = new Map(
    grouped.map((g) => [
      `${g.series}:${g.warehouseId}`,
      { count: g._count._all, rangeEnd: g._max.rangeEnd },
    ]),
  );

  const warehouseIds = new Set<string>();
  for (const g of grouped) {
    warehouseIds.add(g.warehouseId);
  }
  for (const id of options?.ensureWarehouseIds ?? []) {
    if (id) {
      warehouseIds.add(id);
    }
  }

  const snapshots: WarehouseSeriesSnapshot[] = [];

  for (const warehouseId of warehouseIds) {
    const warehouseName = warehouseById.get(warehouseId) ?? warehouseId;
    const seriesRows: WarehouseSeriesRow[] = [];

    for (const series of SERIAL_SERIES_ORDER) {
      const key = `${series}:${warehouseId}`;
      const stats = statsByKey.get(key);
      const latest = latestByKey.get(key);

      seriesRows.push({
        series,
        displayName: getSeriesDisplayName(series),
        reservationCount: stats?.count ?? 0,
        lastRangeEnd:
          stats?.rangeEnd != null
            ? formatSerialNumberForSeries(series, stats.rangeEnd)
            : null,
        lastEventAt: latest?.createdAt.toISOString() ?? null,
        lastEventBy: latest?.createdBy.name ?? null,
      });
    }

    snapshots.push({ warehouseId, warehouseName, seriesRows });
  }

  snapshots.sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));
  return snapshots;
}

export async function getSeriesConfigsForAdvanced(): Promise<SeriesConfigSummary[]> {
  const configs = await getCachedSeriesConfigs();
  const configBySeries = new Map(configs.map((c) => [c.series, c]));

  return SERIAL_SERIES_ORDER.map((series) => {
    const config = configBySeries.get(series);
    return {
      series,
      displayName: getSeriesDisplayName(series),
      ceilingNumber:
        config?.ceilingNumber ?? getDefaultSeriesCeiling(series).toString(),
    };
  });
}

export async function searchSerialNumber(
  serialNumber: string,
): Promise<SerialSearchResult | null> {
  const trimmed = serialNumber.trim();
  if (!trimmed) {
    return null;
  }

  const value = parseSerialBigInt(trimmed);
  if (value == null) {
    return null;
  }

  if (value < getSeriesStartNumber(SerialSeries.LOCK_TAGS)) {
    return null;
  }

  const match = await prisma.serialReservation.findFirst({
    where: {
      AND: [
        validReservationsUnionWhere(),
        { rangeStart: { lte: value }, rangeEnd: { gte: value } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      series: true,
      rangeStart: true,
      rangeEnd: true,
      prId: true,
      poId: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });

  if (!match) {
    return null;
  }

  return {
    id: match.id,
    series: match.series,
    seriesName: getSeriesDisplayName(match.series),
    rangeStart: formatSerialNumberForSeries(match.series, match.rangeStart),
    rangeEnd: formatSerialNumberForSeries(match.series, match.rangeEnd),
    createdByName: match.createdBy.name,
    createdAt: match.createdAt.toISOString(),
    prId: match.prId,
    poId: match.poId,
  };
}

export async function getSerialGovernanceFilterOptions() {
  const warehouses = await getCachedWarehouses();
  return { warehouses };
}

/** @deprecated Use getSerialActivity */
export type RangeHistoryFilters = SerialActivityFilters;
/** @deprecated Use getSerialActivity */
export type PrintHistoryFilters = Omit<SerialActivityFilters, "type">;

/** @deprecated Use getSerialActivity */
export async function getRangeHistory(filters: RangeHistoryFilters) {
  return getSerialActivity(filters);
}

/** @deprecated Use getSerialActivity with type: "Print" */
export async function getPrintHistory(filters: PrintHistoryFilters) {
  return getSerialActivity({ ...filters, type: "Print" });
}

/** @deprecated Use getWarehouseSeriesSnapshot */
export async function getWarehouseAvailability() {
  const snapshots = await getWarehouseSeriesSnapshot();
  return snapshots.flatMap((wh) =>
    wh.seriesRows.map((row) => ({
      series: row.series,
      seriesName: row.displayName,
      warehouseId: wh.warehouseId,
      warehouseName: wh.warehouseName,
      reservationCount: row.reservationCount,
      lastRangeEnd: row.lastRangeEnd,
      lastReservedAt: row.lastEventAt,
    })),
  );
}

/** @deprecated Removed — use getSeriesConfigsForAdvanced */
export async function getSeriesOverview() {
  return [];
}
