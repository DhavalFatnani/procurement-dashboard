/** Stable slug identifying a serial series row in `SeriesConfig`. */
export type SeriesCode = string;

export const SERIES_CODES = {
  LOCK_TAGS: "LOCK_TAGS",
  JEWELLERY_BARCODES: "JEWELLERY_BARCODES",
  APPAREL_BARCODES: "APPAREL_BARCODES",
} as const;

export type BuiltInSeriesCode = (typeof SERIES_CODES)[keyof typeof SERIES_CODES];

const SERIES_CODE_RE = /^[A-Z][A-Z0-9_]{0,47}$/;

export function normalizeSeriesCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}

export function isSeriesCode(value: string): boolean {
  return SERIES_CODE_RE.test(value);
}

export function assertSeriesCode(value: string): SeriesCode {
  const normalized = normalizeSeriesCode(value);
  if (!isSeriesCode(normalized)) {
    throw new Error(
      "Series code must start with a letter and use only A–Z, 0–9, and underscores (max 48 chars).",
    );
  }
  return normalized;
}
