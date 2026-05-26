import { InvoiceMatchStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeInvoiceMatch, computeInvoiceMatchFromExpected } from "@/lib/invoiceMatch";

describe("computeInvoiceMatch", () => {
  it("returns PENDING when unit price is missing", () => {
    const result = computeInvoiceMatch(10, 1000, null);
    expect(result.matchStatus).toBe(InvoiceMatchStatus.PENDING);
    expect(result.expectedAmount).toBeNull();
    expect(result.variance).toBeNull();
  });

  it("returns MATCHED within default 2.5% tolerance", () => {
    const result = computeInvoiceMatch(100, 1020, 10);
    expect(result.matchStatus).toBe(InvoiceMatchStatus.MATCHED);
    expect(result.expectedAmount).toBe(1000);
    expect(result.variance).toBe(20);
    expect(result.variancePct).toBeCloseTo(2, 5);
  });

  it("returns MISMATCH outside tolerance", () => {
    const result = computeInvoiceMatch(100, 1100, 10);
    expect(result.matchStatus).toBe(InvoiceMatchStatus.MISMATCH);
    expect(result.expectedAmount).toBe(1000);
    expect(result.variancePct).toBeCloseTo(10, 5);
  });

  it("respects custom tolerance percentage", () => {
    const result = computeInvoiceMatch(100, 1050, 10, 10);
    expect(result.matchStatus).toBe(InvoiceMatchStatus.MATCHED);
  });
});

describe("computeInvoiceMatchFromExpected", () => {
  it("matches line-weighted expected amount", () => {
    const result = computeInvoiceMatchFromExpected(2000, 2010);
    expect(result.matchStatus).toBe(InvoiceMatchStatus.MATCHED);
    expect(result.expectedAmount).toBe(2000);
  });
});
