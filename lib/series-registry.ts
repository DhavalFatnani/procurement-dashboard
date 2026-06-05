import type { CachedSeriesDefinition } from "@/lib/cache";
import { SERIES_CODES, type SeriesCode } from "@/lib/series-codes";

export type { CachedSeriesDefinition };

export type SeriesRegistryEntry = CachedSeriesDefinition;

export type SeriesRegistry = {
  entries: SeriesRegistryEntry[];
  byCode: Map<SeriesCode, SeriesRegistryEntry>;
  activeCodes: SeriesCode[];
};

/** Built-in seed defaults — used only when the DB registry is empty (dev bootstrap). */
export const BUILTIN_SERIES_DEFINITIONS: Omit<
  SeriesRegistryEntry,
  "id" | "configuredById" | "configuredAt" | "updatedAt"
>[] = [
  {
    code: SERIES_CODES.LOCK_TAGS,
    displayName: "Lock Tags",
    prefixPattern: "000XXXXXXX",
    rangeStart: "100000",
    ceilingNumber: "9999999",
    inactivityThresholdDays: 30,
    ceilingAlertPct: 80,
    sortOrder: 0,
    isActive: true,
  },
  {
    code: SERIES_CODES.JEWELLERY_BARCODES,
    displayName: "Jewellery Barcodes",
    prefixPattern: "1XXXXXXXXX",
    rangeStart: "1000000000",
    ceilingNumber: "9999999999",
    inactivityThresholdDays: 30,
    ceilingAlertPct: 80,
    sortOrder: 1,
    isActive: true,
  },
  {
    code: SERIES_CODES.APPAREL_BARCODES,
    displayName: "Apparel Barcodes",
    prefixPattern: "2XXXXXXXXX",
    rangeStart: "2000000000",
    ceilingNumber: "9999999999",
    inactivityThresholdDays: 30,
    ceilingAlertPct: 80,
    sortOrder: 2,
    isActive: true,
  },
];

export function buildSeriesOptions(registry: SeriesRegistry): {
  code: SeriesCode;
  displayName: string;
}[] {
  return registry.activeCodes.map((code) => ({
    code,
    displayName: getSeriesEntry(registry, code)?.displayName ?? code,
  }));
}

export function buildSeriesRegistry(entries: SeriesRegistryEntry[]): SeriesRegistry {
  const byCode = new Map(entries.map((e) => [e.code, e]));
  const activeCodes = entries
    .filter((e) => e.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((e) => e.code);
  return { entries, byCode, activeCodes };
}

export function getSeriesEntry(
  registry: SeriesRegistry,
  code: SeriesCode,
): SeriesRegistryEntry | undefined {
  return registry.byCode.get(code);
}

export function requireSeriesEntry(
  registry: SeriesRegistry,
  code: SeriesCode,
): SeriesRegistryEntry {
  const entry = getSeriesEntry(registry, code);
  if (!entry) {
    throw new Error(`Unknown series: ${code}`);
  }
  return entry;
}

export function resolveSeriesBounds(entry: SeriesRegistryEntry): {
  start: bigint;
  end: bigint;
} {
  const start = BigInt(entry.rangeStart);
  const end = BigInt(entry.ceilingNumber);
  return { start, end: end >= start ? end : start };
}

export function bandsOverlap(
  aStart: bigint,
  aEnd: bigint,
  bStart: bigint,
  bEnd: bigint,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function findSeriesForSerialValue(
  registry: SeriesRegistry,
  value: bigint,
): SeriesCode | null {
  const matches = registry.entries
    .filter((e) => e.isActive)
    .filter((e) => {
      const { start, end } = resolveSeriesBounds(e);
      return value >= start && value <= end;
    })
    .sort((a, b) => {
      const aStart = BigInt(a.rangeStart);
      const bStart = BigInt(b.rangeStart);
      return aStart > bStart ? -1 : aStart < bStart ? 1 : 0;
    });
  return matches[0]?.code ?? null;
}

type SeriesConfigDbRow = {
  id: string;
  code: string;
  displayName: string;
  prefixPattern: string;
  rangeStart: bigint;
  ceilingNumber: bigint;
  inactivityThresholdDays: number;
  ceilingAlertPct: number;
  sortOrder: number;
  isActive: boolean;
  configuredById: string;
  configuredAt: Date;
  updatedAt: Date;
};

export function cachedDefinitionFromDbRow(row: SeriesConfigDbRow): SeriesRegistryEntry {
  return {
    id: row.id,
    code: row.code,
    displayName: row.displayName,
    prefixPattern: row.prefixPattern,
    rangeStart: row.rangeStart.toString(),
    ceilingNumber: row.ceilingNumber.toString(),
    inactivityThresholdDays: row.inactivityThresholdDays,
    ceilingAlertPct: row.ceilingAlertPct,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    configuredById: row.configuredById,
    configuredAt: row.configuredAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Resolve a single series for transactional code paths (no Next cache). */
export function registryForSeriesCode(
  code: SeriesCode,
  row?: Partial<SeriesConfigDbRow> | null,
): SeriesRegistry {
  const builtin = BUILTIN_SERIES_DEFINITIONS.find((d) => d.code === code);
  if (!builtin) {
    throw new Error(`Unknown series: ${code}`);
  }

  const now = new Date(0);
  const rangeStart = row?.rangeStart ?? BigInt(builtin.rangeStart);
  const rawCeiling = row?.ceilingNumber ?? BigInt(builtin.ceilingNumber);
  const ceilingNumber =
    rawCeiling < rangeStart ? BigInt(builtin.ceilingNumber) : rawCeiling;
  const merged: SeriesConfigDbRow = {
    id: row?.id ?? `builtin-${code}`,
    code,
    displayName: row?.displayName ?? builtin.displayName,
    prefixPattern: row?.prefixPattern ?? builtin.prefixPattern,
    rangeStart,
    ceilingNumber,
    inactivityThresholdDays: row?.inactivityThresholdDays ?? builtin.inactivityThresholdDays,
    ceilingAlertPct: row?.ceilingAlertPct ?? builtin.ceilingAlertPct,
    sortOrder: row?.sortOrder ?? builtin.sortOrder,
    isActive: row?.isActive ?? builtin.isActive,
    configuredById: row?.configuredById ?? "system",
    configuredAt: row?.configuredAt ?? now,
    updatedAt: row?.updatedAt ?? now,
  };

  return buildSeriesRegistry([cachedDefinitionFromDbRow(merged)]);
}

export function validateSeriesBand(
  input: {
    rangeStart: bigint;
    ceilingNumber: bigint;
    code?: SeriesCode;
  },
  registry: SeriesRegistry,
): string | null {
  if (input.ceilingNumber < input.rangeStart) {
    return "Ceiling must be at or above the range start.";
  }
  for (const entry of registry.entries) {
    if (!entry.isActive) continue;
    if (input.code && entry.code === input.code) continue;
    const { start, end } = resolveSeriesBounds(entry);
    if (bandsOverlap(input.rangeStart, input.ceilingNumber, start, end)) {
      return `Numeric band overlaps active series "${entry.displayName}" (${entry.rangeStart}–${entry.ceilingNumber}).`;
    }
  }
  return null;
}
