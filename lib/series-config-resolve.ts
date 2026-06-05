import type { CachedSeriesDefinition } from "@/lib/cache";
import type { SeriesCode } from "@/lib/series-codes";
import {
  buildSeriesRegistry,
  type SeriesRegistry,
  type SeriesRegistryEntry,
} from "@/lib/series-registry";
import {
  resolveSeriesDisplayName,
  resolveSeriesPrefix,
} from "@/lib/serial-series";

export type SeriesConfigLookup = SeriesRegistry;

export function buildSeriesConfigLookup(
  definitions: CachedSeriesDefinition[],
): SeriesConfigLookup {
  return buildSeriesRegistry(definitions);
}

export { resolveSeriesDisplayName, resolveSeriesPrefix };

export type SeriesConfigAdminRow = {
  id: string;
  code: SeriesCode;
  displayName: string;
  prefixPattern: string;
  rangeStart: string;
  ceilingNumber: string;
  inactivityThresholdDays: number;
  ceilingAlertPct: number;
  sortOrder: number;
  isActive: boolean;
  reservationCount: number;
  subcategoryCount: number;
  configuredAt: string;
  configuredByName: string | null;
  canDelete: boolean;
};

export function toSeriesConfigAdminRow(
  entry: SeriesRegistryEntry,
  configuredByNames: Map<string, string>,
  usage: { reservationCount: number; subcategoryCount: number },
): SeriesConfigAdminRow {
  return {
    id: entry.id,
    code: entry.code,
    displayName: entry.displayName,
    prefixPattern: entry.prefixPattern,
    rangeStart: entry.rangeStart,
    ceilingNumber: entry.ceilingNumber,
    inactivityThresholdDays: entry.inactivityThresholdDays,
    ceilingAlertPct: entry.ceilingAlertPct,
    sortOrder: entry.sortOrder,
    isActive: entry.isActive,
    reservationCount: usage.reservationCount,
    subcategoryCount: usage.subcategoryCount,
    configuredAt: entry.configuredAt,
    configuredByName: configuredByNames.get(entry.configuredById) ?? null,
    canDelete: usage.reservationCount === 0 && usage.subcategoryCount === 0,
  };
}

export function buildSeriesConfigAdminRows(
  definitions: CachedSeriesDefinition[],
  configuredByNames: Map<string, string>,
  usageByCode: Map<string, { reservationCount: number; subcategoryCount: number }>,
): SeriesConfigAdminRow[] {
  const registry = buildSeriesRegistry(definitions);
  return registry.entries.map((entry) =>
    toSeriesConfigAdminRow(
      entry,
      configuredByNames,
      usageByCode.get(entry.code) ?? { reservationCount: 0, subcategoryCount: 0 },
    ),
  );
}
