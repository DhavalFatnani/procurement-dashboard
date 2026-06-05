import { SERIES_DISPLAY_WIDTH } from "@/lib/serial-series";

export const SERIES_PREFIX_PATTERN_WIDTH = SERIES_DISPLAY_WIDTH;

/** Strip invalid characters while typing; caps at pattern width. */
export function normalizePrefixPatternInput(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9X]/g, "").slice(0, SERIES_PREFIX_PATTERN_WIDTH);
}

export function validatePrefixPattern(pattern: string): string | null {
  const normalized = normalizePrefixPatternInput(pattern.trim());
  if (!normalized) {
    return "Prefix pattern is required.";
  }
  if (normalized.length !== SERIES_PREFIX_PATTERN_WIDTH) {
    return `Prefix pattern must be exactly ${SERIES_PREFIX_PATTERN_WIDTH} characters.`;
  }
  if (!normalized.includes("X")) {
    return "Prefix pattern must include at least one X for variable digits.";
  }
  return null;
}

export function formatSerialAgainstPattern(value: bigint, patternLength: number): string {
  return value.toString().padStart(patternLength, "0");
}

export function serialValueMatchesPattern(value: bigint, pattern: string): boolean {
  const normalized = normalizePrefixPatternInput(pattern);
  if (validatePrefixPattern(normalized)) {
    return false;
  }
  const formatted = formatSerialAgainstPattern(value, normalized.length);
  if (formatted.length > normalized.length) {
    return false;
  }
  for (let i = 0; i < normalized.length; i++) {
    const slot = normalized[i]!;
    if (slot === "X") {
      continue;
    }
    if (formatted[i] !== slot) {
      return false;
    }
  }
  return true;
}

function describePatternMismatch(value: bigint, pattern: string): string {
  const normalized = normalizePrefixPatternInput(pattern);
  const formatted = formatSerialAgainstPattern(value, normalized.length);
  if (formatted.length > normalized.length) {
    return `value exceeds ${normalized.length} digits for pattern ${normalized}`;
  }
  const mismatches: string[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const slot = normalized[i]!;
    if (slot !== "X" && formatted[i] !== slot) {
      mismatches.push(`digit ${i + 1} must be ${slot}, not ${formatted[i]}`);
    }
  }
  return mismatches.length > 0
    ? mismatches.join("; ")
    : `does not match pattern ${normalized}`;
}

export function validateRangeAlignsWithPrefixPattern(input: {
  rangeStart: bigint;
  ceilingNumber: bigint;
  prefixPattern: string;
}): string | null {
  const patternError = validatePrefixPattern(input.prefixPattern);
  if (patternError) {
    return patternError;
  }
  const pattern = normalizePrefixPatternInput(input.prefixPattern.trim());

  if (!serialValueMatchesPattern(input.rangeStart, pattern)) {
    const padded = formatSerialAgainstPattern(input.rangeStart, pattern.length);
    return `Range start ${input.rangeStart.toString()} (${padded}) ${describePatternMismatch(input.rangeStart, pattern)}.`;
  }
  if (!serialValueMatchesPattern(input.ceilingNumber, pattern)) {
    const padded = formatSerialAgainstPattern(input.ceilingNumber, pattern.length);
    return `Ceiling ${input.ceilingNumber.toString()} (${padded}) ${describePatternMismatch(input.ceilingNumber, pattern)}.`;
  }
  return null;
}

/** Server-side normalization — throws on invalid pattern. */
export function normalizePrefixPattern(raw: string): string {
  const normalized = normalizePrefixPatternInput(raw.trim());
  const error = validatePrefixPattern(normalized);
  if (error) {
    throw new Error(error);
  }
  return normalized;
}
