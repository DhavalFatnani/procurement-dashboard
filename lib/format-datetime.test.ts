import { describe, expect, it } from "vitest";

import { formatDateMedium, formatDateTimeMedium } from "@/lib/format-datetime";

describe("formatDateMedium", () => {
  it("formats in Asia/Kolkata regardless of host timezone", () => {
    // 18:30 UTC = 00:00 IST on the next calendar day
    expect(formatDateMedium("2026-06-17T18:30:00.000Z")).toBe("18 Jun 2026");
  });

  it("returns em dash for empty input", () => {
    expect(formatDateMedium(null)).toBe("—");
    expect(formatDateMedium("")).toBe("—");
  });
});

describe("formatDateTimeMedium", () => {
  it("includes time in Asia/Kolkata", () => {
    const formatted = formatDateTimeMedium("2026-06-17T18:30:00.000Z");
    expect(formatted).toContain("18 Jun 2026");
    expect(formatted).toMatch(/12:00/);
  });
});
