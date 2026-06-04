import { SerialSeries } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import { buildSerialRangeMap } from "./serial-range-map";
import { classifySerialReservation } from "./serial-series";

describe("classifySerialReservation", () => {
  it("classifies PR approval holds", () => {
    expect(
      classifySerialReservation({
        reservationStatus: "PENDING",
        prId: "pr-1",
        poId: null,
      }),
    ).toBe("Hold");
  });

  it("classifies open PO without GRN as unconfirmed", () => {
    expect(
      classifySerialReservation({
        reservationStatus: "RESERVED",
        prId: null,
        poId: "po-1",
        poStatus: "OPEN",
        poHasGrn: false,
      }),
    ).toBe("Unconfirmed");
  });

  it("classifies PO with GRN as receipt", () => {
    expect(
      classifySerialReservation({
        reservationStatus: "RESERVED",
        prId: null,
        poId: "po-1",
        poStatus: "OPEN",
        poHasGrn: true,
      }),
    ).toBe("Receipt");
  });

  it("classifies internal print on PR", () => {
    expect(
      classifySerialReservation({
        reservationStatus: "RESERVED",
        prId: "pr-1",
        poId: null,
      }),
    ).toBe("Print");
  });
});

describe("buildSerialRangeMap", () => {
  it("builds segments with free gaps and lifecycle phases", () => {
    const map = buildSerialRangeMap({
      series: SerialSeries.LOCK_TAGS,
      displayName: "Lock Tags",
      ceiling: BigInt(100_199),
      zoomToActive: false,
      reservations: [
        {
          id: "hold-1",
          rangeStart: BigInt(100_000),
          rangeEnd: BigInt(100_049),
          quantity: 50,
          status: "PENDING",
          prId: "pr-1",
          poId: null,
          warehouseId: "wh-1",
          warehouseName: "WH A",
          createdByName: "Ops",
          createdAt: "2026-01-01T00:00:00.000Z",
          poStatus: null,
          poHasGrn: false,
        },
        {
          id: "po-1",
          rangeStart: BigInt(100_050),
          rangeEnd: BigInt(100_099),
          quantity: 50,
          status: "RESERVED",
          prId: null,
          poId: "po-1",
          warehouseId: "wh-1",
          warehouseName: "WH A",
          createdByName: "Ops",
          createdAt: "2026-01-02T00:00:00.000Z",
          poStatus: "OPEN",
          poHasGrn: false,
        },
      ],
    });

    expect(map.stats.onApprovalHold).toBe(50);
    expect(map.stats.poCancellable).toBe(50);
    expect(map.segments.some((s) => s.phase === "free")).toBe(true);
    expect(map.segments.find((s) => s.id === "hold-1")?.phase).toBe("approval_hold");
    expect(map.segments.find((s) => s.id === "po-1")?.phase).toBe("po_cancellable");
  });
});
