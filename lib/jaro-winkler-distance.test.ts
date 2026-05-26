import { describe, expect, it } from "vitest";

import { jaroWinklerDistance } from "./jaro-winkler-distance";

describe("jaroWinklerDistance", () => {
  it("returns 1 for identical strings (including empty)", () => {
    expect(jaroWinklerDistance("hello", "hello")).toBe(1);
    expect(jaroWinklerDistance("", "")).toBe(1);
  });

  it("returns 0 when one string is empty and the other is not", () => {
    expect(jaroWinklerDistance("abc", "")).toBe(0);
    expect(jaroWinklerDistance("", "abc")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(jaroWinklerDistance("MARTHA", "martha")).toBe(1);
    expect(jaroWinklerDistance("Acme Corp", "acme corp")).toBe(1);
  });

  it("matches known reference values (MARTHA/MARHTA)", () => {
    expect(jaroWinklerDistance("MARTHA", "MARHTA")).toBeCloseTo(0.961, 3);
  });

  it("matches known reference values (DIXON/DICKSONX)", () => {
    expect(jaroWinklerDistance("DIXON", "DICKSONX")).toBeCloseTo(0.813, 3);
  });

  it("rewards a shared common prefix (Winkler bonus)", () => {
    const withPrefix = jaroWinklerDistance("prefabc", "prefxyz");
    const withoutPrefix = jaroWinklerDistance("abcpref", "xyzpref");
    expect(withPrefix).toBeGreaterThan(withoutPrefix);
  });

  it("returns 0 for fully disjoint strings", () => {
    expect(jaroWinklerDistance("abc", "xyz")).toBe(0);
  });

  it("always returns a value within [0, 1]", () => {
    const pairs: [string, string][] = [
      ["alpha packaging", "alpha packing"],
      ["beta supplies ltd", "beta supply limited"],
      ["zzz", "aaaaaa"],
    ];
    for (const [a, b] of pairs) {
      const score = jaroWinklerDistance(a, b);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
