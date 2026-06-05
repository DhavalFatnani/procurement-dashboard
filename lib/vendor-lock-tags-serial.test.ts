import { PRStatus } from "@/lib/prisma-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SERIES_CODES } from "@/lib/series-codes";

const txFindUnique = vi.fn();
const txFindFirst = vi.fn();
const txFindMany = vi.fn();
const txCreate = vi.fn();
const txUpdate = vi.fn();
const txDeleteMany = vi.fn();
const txSeriesConfigFindUnique = vi.fn();
const txPrFindUnique = vi.fn();

function makeTx() {
  return {
    serialReservation: {
      findUnique: txFindUnique,
      findFirst: txFindFirst,
      findMany: txFindMany,
      create: txCreate,
      update: txUpdate,
      deleteMany: txDeleteMany,
    },
    seriesConfig: { findUnique: txSeriesConfigFindUnique },
    purchaseRequest: { findUnique: txPrFindUnique },
  };
}

import {
  commitVendorLockTagsHoldToPo,
  createVendorLockTagsApprovalHold,
  releaseVendorLockTagsApprovalHold,
  releaseVendorLockTagsPoReservation,
} from "./vendor-lock-tags-serial";

beforeEach(() => {
  vi.clearAllMocks();
  txFindUnique.mockResolvedValue(null);
  txFindFirst.mockResolvedValue(null);
  txFindMany.mockResolvedValue([]);
  txSeriesConfigFindUnique.mockResolvedValue(null);
  txPrFindUnique.mockResolvedValue({ id: "pr-1", status: PRStatus.APPROVED });
  txDeleteMany.mockResolvedValue({ count: 1 });
});

describe("createVendorLockTagsApprovalHold", () => {
  it("returns null when quantity is zero", async () => {
    const result = await createVendorLockTagsApprovalHold(makeTx() as never, {
      prId: "pr-1",
      quantity: 0,
      warehouseId: "wh-1",
      createdById: "user-1",
    });
    expect(result).toBeNull();
    expect(txCreate).not.toHaveBeenCalled();
  });

  it("returns existing hold when idempotency key matches", async () => {
    const existing = { id: "hold-1", status: "PENDING" };
    txFindUnique.mockResolvedValue(existing);

    const result = await createVendorLockTagsApprovalHold(makeTx() as never, {
      prId: "pr-1",
      quantity: 100,
      warehouseId: "wh-1",
      createdById: "user-1",
    });

    expect(result).toBe(existing);
    expect(txCreate).not.toHaveBeenCalled();
  });

  it("creates PENDING hold on approved PR", async () => {
    txFindFirst.mockResolvedValue(null);
    txCreate.mockResolvedValue({ id: "hold-new", status: "PENDING" });

    await createVendorLockTagsApprovalHold(makeTx() as never, {
      prId: "pr-1",
      quantity: 50,
      warehouseId: "wh-1",
      createdById: "user-1",
    });

    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          series: SERIES_CODES.LOCK_TAGS,
          quantity: 50,
          status: "PENDING",
          prId: "pr-1",
          idempotencyKey: "pr-pr-1-lock-tags-hold",
        }),
      }),
    );
  });
});

describe("commitVendorLockTagsHoldToPo", () => {
  const hold = {
    id: "hold-1",
    rangeStart: BigInt(100000),
    rangeEnd: BigInt(100099),
    quantity: 100,
  };

  it("converts full hold to PO reservation", async () => {
    txFindFirst.mockResolvedValue(hold);
    txUpdate.mockResolvedValue({ id: "hold-1", status: "RESERVED", poId: "po-1" });

    await commitVendorLockTagsHoldToPo(makeTx() as never, {
      prId: "pr-1",
      poId: "po-1",
      quantity: 100,
      warehouseId: "wh-1",
      createdById: "user-1",
    });

    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "hold-1" },
      data: {
        status: "RESERVED",
        prId: null,
        poId: "po-1",
        idempotencyKey: "po-po-1-lock-tags",
      },
    });
    expect(txCreate).not.toHaveBeenCalled();
  });

  it("splits hold for partial PO", async () => {
    txFindFirst.mockResolvedValue(hold);
    txCreate.mockResolvedValue({ id: "po-res", status: "RESERVED" });

    await commitVendorLockTagsHoldToPo(makeTx() as never, {
      prId: "pr-1",
      poId: "po-1",
      quantity: 40,
      warehouseId: "wh-1",
      createdById: "user-1",
    });

    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rangeStart: BigInt(100000),
          rangeEnd: BigInt(100039),
          quantity: 40,
          status: "RESERVED",
          poId: "po-1",
        }),
      }),
    );
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "hold-1" },
      data: {
        rangeStart: BigInt(100040),
        rangeEnd: BigInt(100099),
        quantity: 60,
      },
    });
  });

  it("throws when PO qty exceeds hold", async () => {
    txFindFirst.mockResolvedValue(hold);

    await expect(
      commitVendorLockTagsHoldToPo(makeTx() as never, {
        prId: "pr-1",
        poId: "po-1",
        quantity: 200,
        warehouseId: "wh-1",
        createdById: "user-1",
      }),
    ).rejects.toThrow(/exceeds the PR hold/);
  });
});

describe("release helpers", () => {
  it("releaseVendorLockTagsApprovalHold deletes PENDING PR holds", async () => {
    await releaseVendorLockTagsApprovalHold(makeTx() as never, "pr-1");
    expect(txDeleteMany).toHaveBeenCalledWith({
      where: { prId: "pr-1", status: "PENDING", poId: null },
    });
  });

  it("releaseVendorLockTagsPoReservation deletes PO lock-tag reservations", async () => {
    await releaseVendorLockTagsPoReservation(makeTx() as never, "po-1");
    expect(txDeleteMany).toHaveBeenCalledWith({
      where: { poId: "po-1", series: SERIES_CODES.LOCK_TAGS },
    });
  });
});
