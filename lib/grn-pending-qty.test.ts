import { describe, expect, it } from "vitest";

import {
  isVisibleGrnReceipt,
  pendingQtyForNextGrnReceipt,
  sumReceivedQtyOnPoLine,
} from "@/lib/grn-pending-qty";

describe("grn pending qty", () => {
  it("sums received on PO line across GRN line rows", () => {
    expect(
      sumReceivedQtyOnPoLine([
        { receivedQty: 49_500 },
        { receivedQty: 500 },
      ]),
    ).toBe(50_000);
  });

  it("pending is zero while disputed qty is still on a receipt", () => {
    const ordered = 50_000;
    const receivedOnLine = 50_000;
    expect(pendingQtyForNextGrnReceipt(ordered, receivedOnLine)).toBe(0);
  });

  it("pending opens after replace removes disputed from received", () => {
    const ordered = 50_000;
    const receivedAfterReplace = 49_500;
    expect(pendingQtyForNextGrnReceipt(ordered, receivedAfterReplace)).toBe(500);
  });

  it("hides voided receipt headers", () => {
    expect(
      isVisibleGrnReceipt({ receivedQty: 0, acceptedQty: 0, disputedQty: 0 }),
    ).toBe(false);
    expect(
      isVisibleGrnReceipt({ receivedQty: 0, acceptedQty: 0, disputedQty: 1 }),
    ).toBe(true);
  });

  it("uses effective ordered after accept-at-new-price split", () => {
    const baseEffectiveOrdered = 49_500;
    const basePreviouslyReceived = 49_000;
    expect(
      pendingQtyForNextGrnReceipt(baseEffectiveOrdered, basePreviouslyReceived),
    ).toBe(500);

    const splitOrdered = 500;
    const splitPreviouslyReceived = 500;
    expect(
      pendingQtyForNextGrnReceipt(splitOrdered, splitPreviouslyReceived),
    ).toBe(0);
  });
});
