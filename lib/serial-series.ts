import {
  ExecutionType,
  SerialReservationPurpose,
  SerialReservationStatus,
} from "@/lib/prisma-enums";
import type { Prisma } from "@/lib/prisma-client";

import type { SeriesCode } from "@/lib/series-codes";
import {
  BUILTIN_SERIES_DEFINITIONS,
  buildSeriesRegistry,
  findSeriesForSerialValue,
  getSeriesEntry,
  requireSeriesEntry,
  resolveSeriesBounds,
  type SeriesRegistry,
  type SeriesRegistryEntry,
} from "@/lib/series-registry";

/** Maximum serial numbers per internal print job. */
export const MAX_INTERNAL_PRINT_QUANTITY = 1000;

/** Label for platform-wide serial blocks (no warehouse scope). */
export const GLOBAL_SERIAL_BLOCK_SCOPE_LABEL = "All warehouses";

/** Fixed width for displaying serial numbers (lock tags show leading zeros). */
export const SERIES_DISPLAY_WIDTH = 10;

const FALLBACK_REGISTRY = buildSeriesRegistry(
  BUILTIN_SERIES_DEFINITIONS.map((row, index) => ({
    ...row,
    id: `builtin-${row.code}`,
    configuredById: "system",
    configuredAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    sortOrder: row.sortOrder ?? index,
  })),
);

export function registryWithFallback(registry?: SeriesRegistry): SeriesRegistry {
  if (!registry || registry.entries.length === 0) {
    return FALLBACK_REGISTRY;
  }
  return registry;
}

export function getActiveSeriesCodes(registry?: SeriesRegistry): SeriesCode[] {
  return registryWithFallback(registry).activeCodes;
}

export function resolveSeriesDisplayName(
  code: SeriesCode,
  registry?: SeriesRegistry,
): string {
  return getSeriesEntry(registryWithFallback(registry), code)?.displayName ?? code;
}

export function resolveSeriesPrefix(code: SeriesCode, registry?: SeriesRegistry): string {
  return getSeriesEntry(registryWithFallback(registry), code)?.prefixPattern ?? "";
}

export function getSeriesStartNumber(
  code: SeriesCode,
  registry?: SeriesRegistry,
): bigint {
  const entry = getSeriesEntry(registryWithFallback(registry), code);
  return entry ? BigInt(entry.rangeStart) : BigInt(0);
}

export function getSeriesCeiling(code: SeriesCode, registry?: SeriesRegistry): bigint {
  const entry = getSeriesEntry(registryWithFallback(registry), code);
  if (!entry) return BigInt(0);
  return resolveSeriesBounds(entry).end;
}

export function resolveSeriesCeiling(
  code: SeriesCode,
  configured: bigint | null | undefined,
  registry?: SeriesRegistry,
): bigint {
  const reg = registryWithFallback(registry);
  const entry = getSeriesEntry(reg, code);
  const builtin = BUILTIN_SERIES_DEFINITIONS.find((d) => d.code === code);
  const fallback = entry
    ? resolveSeriesBounds(entry).end
    : builtin
      ? BigInt(builtin.ceilingNumber)
      : BigInt(0);
  if (configured == null) {
    return fallback;
  }
  const start = getSeriesStartNumber(code, reg);
  if (configured < start) {
    return builtin ? BigInt(builtin.ceilingNumber) : fallback;
  }
  return configured;
}

export function validateInternalPrintQuantity(
  quantity: number,
  executionType: ExecutionType,
): string | null {
  if (
    executionType === ExecutionType.INTERNAL_PRINT &&
    quantity > MAX_INTERNAL_PRINT_QUANTITY
  ) {
    return `Maximum ${MAX_INTERNAL_PRINT_QUANTITY.toLocaleString("en-IN")} serial numbers per print job.`;
  }
  return null;
}

export function getSeriesNumericBounds(
  code: SeriesCode,
  registry?: SeriesRegistry,
): { start: bigint; end: bigint } {
  const entry = getSeriesEntry(registryWithFallback(registry), code);
  if (!entry) {
    return { start: BigInt(0), end: BigInt(0) };
  }
  return resolveSeriesBounds(entry);
}

export function isSerialInSeriesRange(
  code: SeriesCode,
  value: bigint,
  registry?: SeriesRegistry,
): boolean {
  const { start, end } = getSeriesNumericBounds(code, registry);
  return value >= start && value <= end;
}

export function isValidReservationRange(
  code: SeriesCode,
  rangeStart: bigint,
  rangeEnd: bigint,
  registry?: SeriesRegistry,
): boolean {
  const { start, end } = getSeriesNumericBounds(code, registry);
  return rangeStart >= start && rangeEnd >= rangeStart && rangeEnd <= end;
}

export function computeNextRangeStart(
  code: SeriesCode,
  lastValidRangeEnd: bigint | null | undefined,
  registry?: SeriesRegistry,
): bigint {
  const start = getSeriesStartNumber(code, registry);
  if (lastValidRangeEnd == null || lastValidRangeEnd < start) {
    return start;
  }
  return lastValidRangeEnd + BigInt(1);
}

export function formatSerialNumberForSeries(
  _code: SeriesCode,
  value: bigint | string,
): string {
  const raw = formatSerialNumber(value);
  return raw.padStart(SERIES_DISPLAY_WIDTH, "0");
}

export function validReservationsForSeriesWhere(
  code: SeriesCode,
  registry?: SeriesRegistry,
): Prisma.SerialReservationWhereInput {
  const { start, end } = getSeriesNumericBounds(code, registry);
  return {
    series: code,
    rangeStart: { gte: start },
    rangeEnd: { gte: start, lte: end },
  };
}

export function activeReservationsForSeriesWhere(
  code: SeriesCode,
  registry?: SeriesRegistry,
): Prisma.SerialReservationWhereInput {
  return {
    ...validReservationsForSeriesWhere(code, registry),
    status: { in: ["PENDING", "RESERVED"] },
  };
}

export function activeReservationsUnionWhere(
  registry?: SeriesRegistry,
): Prisma.SerialReservationWhereInput {
  const reg = registryWithFallback(registry);
  return {
    OR: reg.activeCodes.map((code) => activeReservationsForSeriesWhere(code, reg)),
  };
}

export function validReservationsUnionWhere(
  registry?: SeriesRegistry,
): Prisma.SerialReservationWhereInput {
  const reg = registryWithFallback(registry);
  return {
    OR: reg.activeCodes.map((code) => validReservationsForSeriesWhere(code, reg)),
  };
}

export function detectSeriesFromSerialNumber(
  raw: string,
  registry?: SeriesRegistry,
): SeriesCode | null {
  const value = parseSerialBigInt(raw);
  if (value == null) {
    return null;
  }
  return findSeriesForSerialValue(registryWithFallback(registry), value);
}

export function parseSerialBigInt(raw: string): bigint | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  try {
    return BigInt(digits);
  } catch {
    return null;
  }
}

export function formatSerialNumber(value: bigint | string): string {
  return typeof value === "bigint" ? value.toString() : value;
}

export function computeRangeUsedPct(
  code: SeriesCode,
  lastRangeEnd: bigint | null,
  ceiling: bigint,
  registry?: SeriesRegistry,
): number {
  const start = getSeriesStartNumber(code, registry);
  if (ceiling <= start) {
    return 0;
  }
  const end = lastRangeEnd ?? start;
  const used = end > start ? end - start : BigInt(0);
  const total = ceiling - start;
  return Number((used * BigInt(100)) / total);
}

/** How the reservation sits in the procurement lifecycle — not physical consumption. */
export type ReservationEventType =
  | "Print"
  | "Hold"
  | "Unconfirmed"
  | "Receipt";

export type SerialRangePhase =
  | "free"
  | "internal_print"
  | "approval_hold"
  | "po_cancellable"
  | "po_committed"
  | "admin_block";

export function classifySerialReservation(input: {
  reservationStatus: SerialReservationStatus;
  poId: string | null;
  prId: string | null;
  poStatus?: string | null;
  poHasGrn?: boolean;
}): ReservationEventType {
  if (input.reservationStatus === "RELEASED") {
    return "Print";
  }
  if (input.poId) {
    const cancellable =
      input.poStatus === "OPEN" && input.poHasGrn !== true;
    return cancellable ? "Unconfirmed" : "Receipt";
  }
  if (input.prId && input.reservationStatus === "PENDING") {
    return "Hold";
  }
  return "Print";
}

export function reservationPhaseFromReservation(input: {
  reservationStatus: SerialReservationStatus;
  poId: string | null;
  prId: string | null;
  poStatus?: string | null;
  poHasGrn?: boolean;
  purpose?: SerialReservationPurpose;
}): Exclude<SerialRangePhase, "free"> {
  if (input.purpose === SerialReservationPurpose.ADMIN_BLOCK) {
    return "admin_block";
  }
  const event = classifySerialReservation(input);
  switch (event) {
    case "Hold":
      return "approval_hold";
    case "Unconfirmed":
      return "po_cancellable";
    case "Receipt":
      return "po_committed";
    case "Print":
    default:
      return "internal_print";
  }
}

/** @deprecated Prefer {@link classifySerialReservation} with reservation status. */
export function reservationEventType(
  poId: string | null,
  prId: string | null,
  reservationStatus: SerialReservationStatus = "RESERVED",
  poMeta?: { status: string | null; hasGrn: boolean },
): ReservationEventType {
  return classifySerialReservation({
    reservationStatus,
    poId,
    prId,
    poStatus: poMeta?.status,
    poHasGrn: poMeta?.hasGrn,
  });
}

/** @deprecated Use resolveSeriesDisplayName */
export function getSeriesDisplayName(code: SeriesCode, registry?: SeriesRegistry): string {
  return resolveSeriesDisplayName(code, registry);
}

/** @deprecated Use resolveSeriesPrefix */
export function getSeriesPrefix(code: SeriesCode, registry?: SeriesRegistry): string {
  return resolveSeriesPrefix(code, registry);
}

/** @deprecated Use getSeriesCeiling */
export function getDefaultSeriesCeiling(code: SeriesCode, registry?: SeriesRegistry): bigint {
  return getSeriesCeiling(code, registry);
}

/** @deprecated Use resolveSeriesDisplayName */
export function getDefaultSeriesDisplayName(code: SeriesCode, registry?: SeriesRegistry): string {
  return resolveSeriesDisplayName(code, registry);
}

/** @deprecated Use resolveSeriesPrefix */
export function getDefaultSeriesPrefix(code: SeriesCode, registry?: SeriesRegistry): string {
  return resolveSeriesPrefix(code, registry);
}

/** @deprecated Use getActiveSeriesCodes */
export const SERIAL_SERIES_ORDER: SeriesCode[] = FALLBACK_REGISTRY.activeCodes;

export function requireRegistryEntry(
  registry: SeriesRegistry,
  code: SeriesCode,
): SeriesRegistryEntry {
  return requireSeriesEntry(registry, code);
}
