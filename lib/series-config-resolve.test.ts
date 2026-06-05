import { describe, expect, it } from "vitest";

import type { CachedSeriesDefinition } from "@/lib/cache";
import {
  buildSeriesConfigAdminRows,
  buildSeriesConfigLookup,
  resolveSeriesDisplayName,
  resolveSeriesPrefix,
} from "@/lib/series-config-resolve";
import { SERIES_CODES } from "@/lib/series-codes";

function config(
  overrides: Partial<CachedSeriesDefinition> & Pick<CachedSeriesDefinition, "code">,
): CachedSeriesDefinition {
  const { code, ...rest } = overrides;
  return {
    id: "cfg-1",
    code,
    displayName: "Lock Tags",
    prefixPattern: "000XXXXXXX",
    rangeStart: "100000",
    inactivityThresholdDays: 30,
    ceilingNumber: "9999999",
    ceilingAlertPct: 80,
    sortOrder: 0,
    isActive: true,
    configuredById: "user-1",
    configuredAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...rest,
  };
}

describe("series-config-resolve", () => {
  it("falls back to built-in labels when no override", () => {
    const lookup = buildSeriesConfigLookup([]);
    expect(resolveSeriesDisplayName(SERIES_CODES.LOCK_TAGS, lookup)).toBe("Lock Tags");
    expect(resolveSeriesPrefix(SERIES_CODES.LOCK_TAGS, lookup)).toBe("000XXXXXXX");
  });

  it("uses admin overrides from lookup", () => {
    const lookup = buildSeriesConfigLookup([
      config({
        code: SERIES_CODES.LOCK_TAGS,
        displayName: "Smart Locks",
        prefixPattern: "0001234567",
      }),
    ]);
    expect(resolveSeriesDisplayName(SERIES_CODES.LOCK_TAGS, lookup)).toBe("Smart Locks");
    expect(resolveSeriesPrefix(SERIES_CODES.LOCK_TAGS, lookup)).toBe("0001234567");
  });

  it("builds admin rows with usage and actor name", () => {
    const rows = buildSeriesConfigAdminRows(
      [config({ code: SERIES_CODES.JEWELLERY_BARCODES, displayName: "Gold Tags" })],
      new Map([["user-1", "Admin User"]]),
      new Map([[SERIES_CODES.JEWELLERY_BARCODES, { reservationCount: 2, subcategoryCount: 1 }]]),
    );
    const jewellery = rows.find((r) => r.code === SERIES_CODES.JEWELLERY_BARCODES);
    expect(jewellery?.displayName).toBe("Gold Tags");
    expect(jewellery?.reservationCount).toBe(2);
    expect(jewellery?.configuredByName).toBe("Admin User");

    const apparel = rows.find((r) => r.code === SERIES_CODES.APPAREL_BARCODES);
    expect(apparel).toBeUndefined();
  });
});
