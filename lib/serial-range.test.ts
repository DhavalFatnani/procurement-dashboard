import { describe, expect, it } from "vitest";

import { listSerialNumbersInRange } from "@/lib/serial-range";

describe("listSerialNumbersInRange", () => {
  it("returns inclusive numeric strings without formatting", () => {
    expect(listSerialNumbersInRange("1000000000", "1000000002")).toEqual([
      "1000000000",
      "1000000001",
      "1000000002",
    ]);
  });

  it("returns empty array when end is before start", () => {
    expect(listSerialNumbersInRange("10", "5")).toEqual([]);
  });
});
