import { describe, expect, it } from "vitest";

import { parseBinLabelCsv } from "@/lib/bin-label-csv";

describe("parseBinLabelCsv", () => {
  it("parses single-column list without headers", () => {
    const result = parseBinLabelCsv("A-01\nA-02\n\nA-03");
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { binCode: "A-01" },
      { binCode: "A-02" },
      { binCode: "A-03" },
    ]);
  });

  it("parses header row with all columns", () => {
    const result = parseBinLabelCsv(
      "bin_code,zone,aisle,shelf\nA-12-03,Zone A,12,03\nB-01-02,Zone B,01,02",
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      binCode: "A-12-03",
      zone: "Zone A",
      aisle: "12",
      shelf: "03",
    });
  });

  it("accepts bin header alias", () => {
    const result = parseBinLabelCsv("bin,zone\nX-1,North");
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.binCode).toBe("X-1");
    expect(result.rows[0]?.zone).toBe("North");
  });

  it("reports duplicate bin codes", () => {
    const result = parseBinLabelCsv("A-01\nA-01");
    expect(result.rows).toHaveLength(1);
    expect(result.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("reports empty file", () => {
    const result = parseBinLabelCsv("  \n  ");
    expect(result.rows).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
