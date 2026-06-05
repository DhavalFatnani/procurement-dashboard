import { SerialReservationPurpose } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";
import { SERIES_CODES } from "@/lib/series-codes";

import {
  activeReservationsConflictingWithAdminBlock,
  activeReservationsConflictingWithWarehouseAllocation,
} from "./serial-block-scope";

describe("activeReservationsConflictingWithAdminBlock", () => {
  it("uses full series scope for global blocks", () => {
    const where = activeReservationsConflictingWithAdminBlock(SERIES_CODES.LOCK_TAGS, {
      kind: "global",
    });
    expect(where).toMatchObject({
      series: SERIES_CODES.LOCK_TAGS,
      status: { in: ["PENDING", "RESERVED"] },
    });
    expect(where).not.toHaveProperty("OR");
  });

  it("scopes warehouse blocks to global blocks, same warehouse, and operational holds", () => {
    const where = activeReservationsConflictingWithAdminBlock(SERIES_CODES.LOCK_TAGS, {
      kind: "warehouse",
      warehouseId: "wh-a",
    });
    expect(where.OR).toEqual([
      { purpose: SerialReservationPurpose.ADMIN_BLOCK, warehouseId: null },
      { warehouseId: "wh-a" },
      { purpose: { not: SerialReservationPurpose.ADMIN_BLOCK } },
    ]);
  });
});

describe("activeReservationsConflictingWithWarehouseAllocation", () => {
  it("includes global admin blocks and warehouse-specific admin blocks", () => {
    const where = activeReservationsConflictingWithWarehouseAllocation(
      SERIES_CODES.LOCK_TAGS,
      "wh-b",
    );
    expect(where.OR).toEqual([
      { purpose: { not: SerialReservationPurpose.ADMIN_BLOCK } },
      { purpose: SerialReservationPurpose.ADMIN_BLOCK, warehouseId: null },
      { purpose: SerialReservationPurpose.ADMIN_BLOCK, warehouseId: "wh-b" },
    ]);
  });
});
