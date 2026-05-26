import { describe, expect, it } from "vitest";

import {
  formatGrnReceiptLabel,
  formatProcurementRef,
  formatSerialBatchLabel,
  formatShortRef,
  procurementRefPath,
} from "./display-ref";

describe("formatProcurementRef", () => {
  it("shortens PR- and PO- prefixed UUIDs", () => {
    const id = "PR-550e8400-e29b-41d4-a716-446655440000";
    expect(formatProcurementRef(id)).toBe("PR-550E8400");
  });

  it("shortens PO refs", () => {
    expect(formatProcurementRef("PO-abcdef12-3456-7890-abcd-ef1234567890")).toBe(
      "PO-ABCDEF12",
    );
  });
});

describe("formatShortRef", () => {
  it("shows last 8 chars for opaque ids", () => {
    expect(formatShortRef("clxyz123abcdefghij")).toMatch(/^[A-Z0-9]{8}$/);
  });
});

describe("procurementRefPath", () => {
  it("maps PR and PO to routes", () => {
    expect(procurementRefPath("PR-abc")).toBe("/purchase-requests/PR-abc");
    expect(procurementRefPath("PO-abc")).toBe("/purchase-orders/PO-abc");
    expect(procurementRefPath("clxyz")).toBeNull();
  });
});

describe("contextual labels", () => {
  it("formats GRN receipt label", () => {
    expect(
      formatGrnReceiptLabel("PO-550e8400-e29b-41d4-a716-446655440000", "2026-05-22T10:00:00.000Z", "Acme"),
    ).toContain("Acme");
    expect(
      formatGrnReceiptLabel("PO-550e8400-e29b-41d4-a716-446655440000", "2026-05-22T10:00:00.000Z", "Acme"),
    ).toContain("PO-550E8400");
  });

  it("formats serial batch label", () => {
    expect(
      formatSerialBatchLabel({
        seriesName: "Lock tags",
        rangeStart: "100000",
        rangeEnd: "100049",
        quantity: 50,
      }),
    ).toBe("Lock tags · 100000–100049 (50)");
  });
});
