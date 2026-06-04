import {
  deriveCashDue,
  maxAdvanceApplicable,
} from "@/lib/settlement-helpers";
import { describe, expect, it } from "vitest";

describe("settlement helpers", () => {
  it("caps advance at min of unallocated and remaining", () => {
    expect(maxAdvanceApplicable(200, 1000)).toBe(200);
    expect(maxAdvanceApplicable(500, 300)).toBe(300);
    expect(maxAdvanceApplicable(0, 100)).toBe(0);
  });

  it("derives cash due from remaining minus advance allocation", () => {
    expect(deriveCashDue(1000, 200)).toBe(800);
    expect(deriveCashDue(200, 200)).toBe(0);
    expect(deriveCashDue(100, 150)).toBe(0);
  });
});
