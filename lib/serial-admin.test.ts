import { describe, expect, it } from "vitest";

import { rangesOverlap } from "@/lib/serial-range-overlap";

describe("rangesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(rangesOverlap(BigInt(10), BigInt(20), BigInt(15), BigInt(25))).toBe(true);
    expect(rangesOverlap(BigInt(10), BigInt(20), BigInt(21), BigInt(30))).toBe(false);
    expect(rangesOverlap(BigInt(10), BigInt(20), BigInt(20), BigInt(30))).toBe(true);
  });
});
