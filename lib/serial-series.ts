import { ExecutionType, SerialSeries } from "@/lib/prisma-enums";
import type { Prisma } from "@/lib/prisma-client";

/** Maximum serial numbers per internal print job. */
export const MAX_INTERNAL_PRINT_QUANTITY = 1000;

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

export function getSeriesStartNumber(series: SerialSeries): bigint {
  switch (series) {
    case SerialSeries.LOCK_TAGS:
      return BigInt(100_000);
    case SerialSeries.JEWELLERY_BARCODES:
      return BigInt(1_000_000_000);
    case SerialSeries.APPAREL_BARCODES:
      return BigInt(2_000_000_000);
  }
}

/** Max serial for the series — must be above {@link getSeriesStartNumber}. */
export function getDefaultSeriesCeiling(series: SerialSeries): bigint {
  switch (series) {
    case SerialSeries.LOCK_TAGS:
      return BigInt(9_999_999);
    case SerialSeries.JEWELLERY_BARCODES:
    case SerialSeries.APPAREL_BARCODES:
      return BigInt(9_999_999_999);
  }
}

/** Use configured ceiling when valid; otherwise default (fixes seed/config below series start). */
export function resolveSeriesCeiling(
  series: SerialSeries,
  configured: bigint | null | undefined,
): bigint {
  const fallback = getDefaultSeriesCeiling(series);
  if (configured == null) {
    return fallback;
  }
  const start = getSeriesStartNumber(series);
  return configured < start ? fallback : configured;
}

export const SERIAL_SERIES_ORDER: SerialSeries[] = [
  SerialSeries.LOCK_TAGS,
  SerialSeries.JEWELLERY_BARCODES,
  SerialSeries.APPAREL_BARCODES,
];

export function getSeriesDisplayName(series: SerialSeries): string {
  switch (series) {
    case SerialSeries.LOCK_TAGS:
      return "Lock Tags";
    case SerialSeries.JEWELLERY_BARCODES:
      return "Jewellery Barcodes";
    case SerialSeries.APPAREL_BARCODES:
      return "Apparel Barcodes";
  }
}

export function getSeriesPrefix(series: SerialSeries): string {
  switch (series) {
    case SerialSeries.LOCK_TAGS:
      return "000XXXXXXX";
    case SerialSeries.JEWELLERY_BARCODES:
      return "1XXXXXXXXX";
    case SerialSeries.APPAREL_BARCODES:
      return "2XXXXXXXXX";
  }
}

/** Fixed width for displaying serial numbers (lock tags show leading zeros). */
export const SERIES_DISPLAY_WIDTH = 10;

export function getSeriesNumericBounds(series: SerialSeries): {
  start: bigint;
  end: bigint;
} {
  return {
    start: getSeriesStartNumber(series),
    end: getDefaultSeriesCeiling(series),
  };
}

export function isSerialInSeriesRange(series: SerialSeries, value: bigint): boolean {
  const { start, end } = getSeriesNumericBounds(series);
  return value >= start && value <= end;
}

export function isValidReservationRange(
  series: SerialSeries,
  rangeStart: bigint,
  rangeEnd: bigint,
): boolean {
  const { start, end } = getSeriesNumericBounds(series);
  return rangeStart >= start && rangeEnd >= rangeStart && rangeEnd <= end;
}

export function computeNextRangeStart(
  series: SerialSeries,
  lastValidRangeEnd: bigint | null | undefined,
): bigint {
  const start = getSeriesStartNumber(series);
  if (lastValidRangeEnd == null || lastValidRangeEnd < start) {
    return start;
  }
  return lastValidRangeEnd + BigInt(1);
}

export function formatSerialNumberForSeries(
  series: SerialSeries,
  value: bigint | string,
): string {
  const raw = formatSerialNumber(value);
  return raw.padStart(SERIES_DISPLAY_WIDTH, "0");
}

/** Prisma filter for reservations that sit inside a series' numeric band. */
export function validReservationsForSeriesWhere(
  series: SerialSeries,
): Prisma.SerialReservationWhereInput {
  const { start, end } = getSeriesNumericBounds(series);
  return {
    series,
    rangeStart: { gte: start },
    rangeEnd: { gte: start, lte: end },
  };
}

export function validReservationsUnionWhere(): Prisma.SerialReservationWhereInput {
  return {
    OR: SERIAL_SERIES_ORDER.map((series) => validReservationsForSeriesWhere(series)),
  };
}

/** Detect series from serial number using non-overlapping numeric ranges. */
export function detectSeriesFromSerialNumber(raw: string): SerialSeries | null {
  const value = parseSerialBigInt(raw);
  if (value == null) {
    return null;
  }
  if (value >= getSeriesStartNumber(SerialSeries.APPAREL_BARCODES)) {
    return SerialSeries.APPAREL_BARCODES;
  }
  if (value >= getSeriesStartNumber(SerialSeries.JEWELLERY_BARCODES)) {
    return SerialSeries.JEWELLERY_BARCODES;
  }
  if (value >= getSeriesStartNumber(SerialSeries.LOCK_TAGS)) {
    return SerialSeries.LOCK_TAGS;
  }
  return null;
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
  series: SerialSeries,
  lastRangeEnd: bigint | null,
  ceiling: bigint,
): number {
  const start = getSeriesStartNumber(series);
  if (ceiling <= start) {
    return 0;
  }
  const end = lastRangeEnd ?? start;
  const used = end > start ? end - start : BigInt(0);
  const total = ceiling - start;
  return Number((used * BigInt(100)) / total);
}

/** How the reservation was created — not field usage of individual serials. */
export type ReservationEventType = "Print" | "Receipt";

export function reservationEventType(
  poId: string | null,
  _prId: string | null,
): ReservationEventType {
  /** PO-linked reservation (vendor purchase / lock tags received via GRN path). */
  return poId ? "Receipt" : "Print";
}
