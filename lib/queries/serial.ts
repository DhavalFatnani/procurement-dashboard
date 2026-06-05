import { Prisma } from "@/lib/prisma-client";

import { getCachedSeriesRegistry, getCachedWarehouses } from "@/lib/cache";
import { dbParallel } from "@/lib/db-parallel";
import {
  formatWarehouseLabel,
  warehouseOptionsFromRows,
} from "@/lib/format-warehouse";
import { paginatedListQuery, type Paginated } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type {
  SerialActivityRow,
  SerialRangeMapData,
  SerialSearchResult,
  SeriesConfigSummary,
  SeriesUsageSummary,
  WarehouseSeriesRow,
  WarehouseSeriesSnapshot,
} from "@/lib/serial-governance-types";
import { buildSerialRangeMap, type RawSerialReservationRow } from "@/lib/serial-range-map";
import { resolveSeriesDisplayName, resolveSeriesPrefix } from "@/lib/series-config-resolve";
import type { SeriesCode } from "@/lib/series-codes";
import {
  activeReservationsForSeriesWhere,
  computeNextRangeStart,
  computeRangeUsedPct,
  formatSerialNumber,
  formatSerialNumberForSeries,
  GLOBAL_SERIAL_BLOCK_SCOPE_LABEL,
  getSeriesCeiling,
  getSeriesStartNumber,
  parseSerialBigInt,
  reservationEventType,
  resolveSeriesCeiling,
  validReservationsForSeriesWhere,
  validReservationsUnionWhere,
  type ReservationEventType,
} from "@/lib/serial-series";

export type {
  SerialActivityRow,
  SerialRangeMapData,
  SerialSearchResult,
  SeriesConfigSummary,
  SeriesUsageSummary,
  WarehouseSeriesRow,
  WarehouseSeriesSnapshot,
} from "@/lib/serial-governance-types";

export type SerialActivityFilters = {
  series?: SeriesCode;
  type?: ReservationEventType;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  includeExactCount?: boolean;
};

function buildSerialActivityWhere(filters: SerialActivityFilters): Prisma.SerialReservationWhereInput {
  const clauses: Prisma.SerialReservationWhereInput[] = [
    { status: { in: ["PENDING", "RESERVED"] } },
  ];
  if (filters.series) {
    clauses.push({ series: filters.series });
  }
  if (filters.warehouseId) {
    clauses.push({ warehouseId: filters.warehouseId });
  }
  if (filters.type === "Receipt") {
    clauses.push({
      poId: { not: null },
      OR: [
        { po: { status: { not: "OPEN" } } },
        { po: { grns: { some: {} } } },
      ],
    });
  } else if (filters.type === "Unconfirmed") {
    clauses.push({
      poId: { not: null },
      po: { status: "OPEN", grns: { none: {} } },
    });
  } else if (filters.type === "Hold") {
    clauses.push({ prId: { not: null }, poId: null, status: "PENDING" });
  } else if (filters.type === "Print") {
    clauses.push({ prId: { not: null }, poId: null, status: "RESERVED" });
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
  const registry = await getCachedSeriesRegistry();
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
            status: true,
            prId: true,
            poId: true,
            warehouseId: true,
            createdAt: true,
            createdBy: { select: { name: true } },
            warehouse: { select: { name: true, location: true } },
            po: {
              select: {
                status: true,
                _count: { select: { grns: true } },
              },
            },
          },
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            series: r.series,
            seriesName: resolveSeriesDisplayName(r.series, registry),
            rangeStart: formatSerialNumberForSeries(r.series, r.rangeStart),
            rangeEnd: formatSerialNumberForSeries(r.series, r.rangeEnd),
            quantity: r.quantity,
            type: reservationEventType(r.poId, r.prId, r.status, {
              status: r.po?.status ?? null,
              hasGrn: (r.po?._count.grns ?? 0) > 0,
            }),
            reservationStatus: r.status,
            warehouseId: r.warehouseId ?? "",
            warehouseName: r.warehouse
              ? formatWarehouseLabel(r.warehouse.name, r.warehouse.location)
              : GLOBAL_SERIAL_BLOCK_SCOPE_LABEL,
            linkedPrId: r.prId,
            linkedPoId: r.poId,
            poStatus: r.po?.status ?? null,
            createdByName: r.createdBy.name,
            createdAt: r.createdAt.toISOString(),
          })),
        ),
    count: () => prisma.serialReservation.count({ where }),
  });
}

export async function getSeriesUsageSummary(): Promise<SeriesUsageSummary[]> {
  const [registry, warehouses] = await dbParallel(
    () => getCachedSeriesRegistry(),
    () => getCachedWarehouses(),
  );
  const warehouseById = new Map(
    warehouses.map((w) => [w.id, formatWarehouseLabel(w.name, w.location)]),
  );

  const summaries: SeriesUsageSummary[] = [];
  for (const series of registry.activeCodes) {
    const validWhere = validReservationsForSeriesWhere(series, registry);
    const config = registry.byCode.get(series);
    const ceiling = resolveSeriesCeiling(
      series,
      config ? BigInt(config.ceilingNumber) : undefined,
      registry,
    );
    const seriesStart = getSeriesStartNumber(series, registry);

    // Native Promise.all here (not dbParallel): its built-in tuple overloads
    // infer groupBy's heavy result type precisely, whereas dbParallel's variadic
    // signature degrades `_count`/`_max` to a union. Same parallelism either way.
    const [agg, warehouseGrouped, latest] = await Promise.all([
      prisma.serialReservation.aggregate({
        where: validWhere,
        _count: { _all: true },
        _max: { rangeEnd: true },
      }),
      prisma.serialReservation.groupBy({
        by: ["warehouseId"],
        where: validWhere,
        _count: { _all: true },
        _max: { rangeEnd: true },
      }),
      prisma.serialReservation.findFirst({
        where: validWhere,
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          status: true,
          poId: true,
          prId: true,
          po: {
            select: {
              status: true,
              _count: { select: { grns: true } },
            },
          },
          createdBy: { select: { name: true } },
        },
      }),
    ]);

    const lastEnd = agg._max.rangeEnd ?? null;
    const nextStart = computeNextRangeStart(series, lastEnd, registry);

    const warehouseUsage = warehouseGrouped
      .filter((g): g is typeof g & { warehouseId: string } => g.warehouseId != null)
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

    summaries.push({
      series,
      displayName: resolveSeriesDisplayName(series, registry),
      prefix: resolveSeriesPrefix(series, registry),
      seriesStart: formatSerialNumberForSeries(series, seriesStart),
      lastRangeEnd:
        lastEnd != null ? formatSerialNumberForSeries(series, lastEnd) : null,
      nextStart: formatSerialNumberForSeries(series, nextStart),
      reservationCount: agg._count._all,
      usedPct: computeRangeUsedPct(series, lastEnd, ceiling, registry),
      lastEventType: latest
        ? reservationEventType(latest.poId, latest.prId, latest.status, {
            status: latest.po?.status ?? null,
            hasGrn: (latest.po?._count.grns ?? 0) > 0,
          })
        : null,
      lastEventAt: latest?.createdAt.toISOString() ?? null,
      lastEventBy: latest?.createdBy.name ?? null,
      warehouseUsage,
    });
  }

  return summaries;
}

export async function getWarehouseSeriesSnapshot(options?: {
  ensureWarehouseIds?: string[];
}): Promise<WarehouseSeriesSnapshot[]> {
  const registry = await getCachedSeriesRegistry();
  const warehouses = await getCachedWarehouses();
  const warehouseById = new Map(
    warehouses.map((w) => [w.id, formatWarehouseLabel(w.name, w.location)]),
  );

  const grouped = await prisma.serialReservation.groupBy({
    by: ["series", "warehouseId"],
    where: validReservationsUnionWhere(registry),
    _count: { _all: true },
    _max: { rangeEnd: true },
  });

  const latestRows = await prisma.serialReservation.findMany({
    where: validReservationsUnionWhere(registry),
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
    if (g.warehouseId) {
      warehouseIds.add(g.warehouseId);
    }
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

    for (const series of registry.activeCodes) {
      const key = `${series}:${warehouseId}`;
      const stats = statsByKey.get(key);
      const latest = latestByKey.get(key);

      seriesRows.push({
        series,
        displayName: resolveSeriesDisplayName(series, registry),
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
  const registry = await getCachedSeriesRegistry();

  return registry.activeCodes.map((series) => {
    const config = registry.byCode.get(series);
    return {
      series,
      displayName: resolveSeriesDisplayName(series, registry),
      ceilingNumber: config?.ceilingNumber ?? getSeriesCeiling(series, registry).toString(),
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

  const registry = await getCachedSeriesRegistry();
  const minStart = registry.activeCodes.reduce((min, code) => {
    const start = getSeriesStartNumber(code, registry);
    return min === null || start < min ? start : min;
  }, null as bigint | null);
  if (minStart != null && value < minStart) {
    return null;
  }

  const match = await prisma.serialReservation.findFirst({
    where: {
      AND: [
        validReservationsUnionWhere(registry),
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
    seriesName: resolveSeriesDisplayName(match.series, registry),
    rangeStart: formatSerialNumberForSeries(match.series, match.rangeStart),
    rangeEnd: formatSerialNumberForSeries(match.series, match.rangeEnd),
    createdByName: match.createdBy.name,
    createdAt: match.createdAt.toISOString(),
    prId: match.prId,
    poId: match.poId,
  };
}

export async function getSerialGovernanceFilterOptions() {
  const [warehouses, registry] = await Promise.all([
    getCachedWarehouses(),
    getCachedSeriesRegistry(),
  ]);
  return {
    warehouses: warehouseOptionsFromRows(warehouses),
    series: registry.activeCodes.map((code) => ({
      code,
      displayName: resolveSeriesDisplayName(code, registry),
    })),
  };
}

export async function getSerialRangeMap(input: {
  series: SeriesCode;
  zoomToActive?: boolean;
}): Promise<SerialRangeMapData> {
  const registry = await getCachedSeriesRegistry();
  const config = registry.byCode.get(input.series);
  const ceiling = resolveSeriesCeiling(
    input.series,
    config ? BigInt(config.ceilingNumber) : undefined,
    registry,
  );

  const rows = await prisma.serialReservation.findMany({
    where: activeReservationsForSeriesWhere(input.series, registry),
    orderBy: { rangeStart: "asc" },
    select: {
      id: true,
      rangeStart: true,
      rangeEnd: true,
      quantity: true,
      status: true,
      prId: true,
      poId: true,
      warehouseId: true,
      purpose: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      warehouse: { select: { name: true, location: true } },
      po: {
        select: {
          status: true,
          _count: { select: { grns: true } },
        },
      },
    },
  });

  const reservations: RawSerialReservationRow[] = rows.map((r) => ({
    id: r.id,
    rangeStart: r.rangeStart,
    rangeEnd: r.rangeEnd,
    quantity: r.quantity,
    status: r.status,
    prId: r.prId,
    poId: r.poId,
    warehouseId: r.warehouseId ?? "",
    warehouseName: r.warehouse
      ? formatWarehouseLabel(r.warehouse.name, r.warehouse.location)
      : "All warehouses",
    purpose: r.purpose,
    createdByName: r.createdBy.name,
    createdAt: r.createdAt.toISOString(),
    poStatus: r.po?.status ?? null,
    poHasGrn: (r.po?._count.grns ?? 0) > 0,
  }));

  const displayName = resolveSeriesDisplayName(input.series, registry);
  const built = buildSerialRangeMap({
    series: input.series,
    displayName,
    ceiling,
    reservations,
    zoomToActive: input.zoomToActive,
  });

  return {
    series: input.series,
    displayName,
    ...built,
  };
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
