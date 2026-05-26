import { ExecutionType, SerialSeries } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  computeNextRangeStart,
  detectSeriesFromSerialNumber,
  getSeriesStartNumber,
  isValidReservationRange,
  MAX_INTERNAL_PRINT_QUANTITY,
  validateInternalPrintQuantity,
} from "./serial-series";

describe("detectSeriesFromSerialNumber", () => {
  it("classifies lock tags below the jewellery range", () => {
    expect(detectSeriesFromSerialNumber("100050")).toBe(SerialSeries.LOCK_TAGS);
    expect(detectSeriesFromSerialNumber("199999")).toBe(SerialSeries.LOCK_TAGS);
  });

  it("classifies jewellery and apparel by numeric range", () => {
    expect(detectSeriesFromSerialNumber("1000000001")).toBe(
      SerialSeries.JEWELLERY_BARCODES,
    );
    expect(detectSeriesFromSerialNumber("2000000001")).toBe(
      SerialSeries.APPAREL_BARCODES,
    );
  });

  it("returns null for numbers below the lock tag start", () => {
    expect(detectSeriesFromSerialNumber("99999")).toBeNull();
  });
});

describe("series numeric bands", () => {
  it("validates reservation ranges per series", () => {
    expect(
      isValidReservationRange(
        SerialSeries.LOCK_TAGS,
        BigInt(100_000),
        BigInt(100_049),
      ),
    ).toBe(true);
    expect(
      isValidReservationRange(
        SerialSeries.JEWELLERY_BARCODES,
        BigInt(1),
        BigInt(50),
      ),
    ).toBe(false);
    expect(
      isValidReservationRange(
        SerialSeries.JEWELLERY_BARCODES,
        BigInt(1_000_000_000),
        BigInt(1_000_000_049),
      ),
    ).toBe(true);
  });

  it("computes next start from series base when last end is invalid", () => {
    expect(computeNextRangeStart(SerialSeries.JEWELLERY_BARCODES, BigInt(50))).toBe(
      getSeriesStartNumber(SerialSeries.JEWELLERY_BARCODES),
    );
    expect(
      computeNextRangeStart(SerialSeries.JEWELLERY_BARCODES, BigInt(1_000_000_049)),
    ).toBe(BigInt(1_000_000_050));
  });
});

describe("validateInternalPrintQuantity", () => {
  it("allows up to the cap for internal print", () => {
    expect(
      validateInternalPrintQuantity(MAX_INTERNAL_PRINT_QUANTITY, ExecutionType.INTERNAL_PRINT),
    ).toBeNull();
  });

  it("rejects quantities above the cap for internal print", () => {
    const error = validateInternalPrintQuantity(
      MAX_INTERNAL_PRINT_QUANTITY + 1,
      ExecutionType.INTERNAL_PRINT,
    );
    expect(error).toContain("1,000");
  });

  it("does not cap vendor purchase reservations", () => {
    expect(
      validateInternalPrintQuantity(50_000, ExecutionType.VENDOR_PURCHASE),
    ).toBeNull();
  });
});
