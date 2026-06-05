import { describe, expect, it } from "vitest";

import {
  normalizePrefixPatternInput,
  serialValueMatchesPattern,
  validatePrefixPattern,
  validateRangeAlignsWithPrefixPattern,
} from "@/lib/series-prefix-pattern";

describe("series-prefix-pattern", () => {
  it("strips invalid characters from input", () => {
    expect(normalizePrefixPatternInput("000abcXXXX")).toBe("000XXXX");
    expect(normalizePrefixPatternInput("1x2x3x4x5x")).toBe("1X2X3X4X5X");
  });

  it("requires exact width and at least one X", () => {
    expect(validatePrefixPattern("000XXXXXXX")).toBeNull();
    expect(validatePrefixPattern("000XXXX")).toMatch(/exactly 10/);
    expect(validatePrefixPattern("0000000000")).toMatch(/at least one X/);
  });

  it("matches lock-tag range against pattern", () => {
    const pattern = "000XXXXXXX";
    expect(serialValueMatchesPattern(BigInt(100_000), pattern)).toBe(true);
    expect(serialValueMatchesPattern(BigInt(9_999_999), pattern)).toBe(true);
    expect(serialValueMatchesPattern(BigInt(1_000_000_000), pattern)).toBe(false);
  });

  it("matches jewellery range against pattern", () => {
    const pattern = "1XXXXXXXXX";
    expect(serialValueMatchesPattern(BigInt(1_000_000_000), pattern)).toBe(true);
    expect(serialValueMatchesPattern(BigInt(2_000_000_000), pattern)).toBe(false);
  });

  it("rejects misaligned range and ceiling", () => {
    expect(
      validateRangeAlignsWithPrefixPattern({
        prefixPattern: "1XXXXXXXXX",
        rangeStart: BigInt(100_000),
        ceilingNumber: BigInt(9_999_999_999),
      }),
    ).toMatch(/Range start/);

    expect(
      validateRangeAlignsWithPrefixPattern({
        prefixPattern: "000XXXXXXX",
        rangeStart: BigInt(100_000),
        ceilingNumber: BigInt(99_999_999),
      }),
    ).toMatch(/Ceiling/);

    expect(
      validateRangeAlignsWithPrefixPattern({
        prefixPattern: "000XXXXXXX",
        rangeStart: BigInt(100_000),
        ceilingNumber: BigInt(9_999_999),
      }),
    ).toBeNull();
  });
});
