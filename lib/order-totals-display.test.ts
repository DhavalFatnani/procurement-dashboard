import { describe, expect, it } from "vitest";

import {
  formatItemCount,
  formatOrderTotalsInline,
  formatUnitCount,
} from "./order-totals-display";

describe("formatOrderTotalsInline", () => {
  it("separates catalog items from unit totals", () => {
    expect(formatOrderTotalsInline(6, 50_005)).toBe("6 items · 50,005 units");
  });

  it("collapses when item count equals unit count", () => {
    expect(formatOrderTotalsInline(5, 5)).toBe("5 items");
  });

  it("formats units only when item count is unknown", () => {
    expect(formatOrderTotalsInline(0, 1_000)).toBe("1,000 units");
  });
});

describe("formatItemCount", () => {
  it("uses singular for one item", () => {
    expect(formatItemCount(1)).toBe("1 item");
  });
});

describe("formatUnitCount", () => {
  it("uses singular for one unit", () => {
    expect(formatUnitCount(1)).toBe("1 unit");
  });
});
