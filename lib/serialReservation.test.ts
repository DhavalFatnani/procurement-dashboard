import { ExecutionType, PRStatus, Prisma, SerialSeries } from "@/lib/prisma-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the prisma singleton before importing the module under test.
const findUnique = vi.fn();
const txFindUnique = vi.fn();
const txFindFirst = vi.fn();
const txSeriesConfigFindUnique = vi.fn();
const txCreate = vi.fn();
const txPrFindUnique = vi.fn();
const txPrUpdate = vi.fn();
const txPrCreate = vi.fn();
const $transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    serialReservation: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
    $transaction: (...args: unknown[]) => $transaction(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { atomicReserveSerialRange, reserveSerialRangeInTransaction } from "./serialReservation";

const baseInput = {
  quantity: 50,
  warehouseId: "wh-1",
  createdById: "user-1",
  prId: "pr-1",
  idempotencyKey: "key-1",
};

function makeTx() {
  return {
    serialReservation: {
      findUnique: txFindUnique,
      findFirst: txFindFirst,
      create: txCreate,
    },
    seriesConfig: { findUnique: txSeriesConfigFindUnique },
    purchaseRequest: {
      findUnique: txPrFindUnique,
      create: txPrCreate,
      update: txPrUpdate,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // By default, $transaction runs the callback with a fake tx.
  $transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(makeTx()),
  );
  txFindUnique.mockResolvedValue(null);
  txFindFirst.mockResolvedValue(null);
  txSeriesConfigFindUnique.mockResolvedValue(null);
  txPrFindUnique.mockResolvedValue({ id: baseInput.prId, status: PRStatus.DRAFT });
  txPrUpdate.mockResolvedValue({});
});

describe("atomicReserveSerialRange — internal print PR", () => {
  it("creates the PR inside the transaction when internalPrintPR is set", async () => {
    findUnique.mockResolvedValue(null);
    txPrFindUnique.mockResolvedValueOnce(null).mockResolvedValue({
      id: "pr-new",
      status: PRStatus.DRAFT,
    });
    txCreate.mockResolvedValue({ id: "res-1", prId: "pr-new" });

    await atomicReserveSerialRange({
      ...baseInput,
      prId: "pr-new",
      series: SerialSeries.APPAREL_BARCODES,
      purpose: "internal_print",
      internalPrintPR: {
        categoryId: "cat-1",
        subcategoryId: "sub-1",
        quantity: 15,
        warehouseId: "wh-1",
        executionType: ExecutionType.INTERNAL_PRINT,
        createdById: "user-1",
      },
    });

    expect(txPrCreate).toHaveBeenCalledOnce();
    expect(txPrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pr-new" },
        data: { status: PRStatus.EXECUTED_PRINT },
      }),
    );
  });
});

describe("atomicReserveSerialRange — idempotency", () => {
  it("short-circuits and returns the existing reservation before opening a transaction", async () => {
    const existing = { id: "res-existing" };
    findUnique.mockResolvedValue(existing);

    const result = await atomicReserveSerialRange({
      ...baseInput,
      series: SerialSeries.LOCK_TAGS,
    });

    expect(result).toEqual({ success: true, reservation: existing });
    expect($transaction).not.toHaveBeenCalled();
  });
});

describe("atomicReserveSerialRange — range allocation start numbers", () => {
  const cases: [SerialSeries, bigint][] = [
    [SerialSeries.LOCK_TAGS, BigInt(100_000)],
    [SerialSeries.JEWELLERY_BARCODES, BigInt(1_000_000_000)],
    [SerialSeries.APPAREL_BARCODES, BigInt(2_000_000_000)],
  ];

  it.each(cases)(
    "starts %s at its base number when no prior reservation exists",
    async (series, start) => {
      findUnique.mockResolvedValue(null);
      txCreate.mockImplementation(async ({ data }: { data: unknown }) => data);

      const result = await atomicReserveSerialRange({
        ...baseInput,
        series,
        purpose: "internal_print",
      });

      expect(result.success).toBe(true);
      expect(txCreate).toHaveBeenCalledOnce();
      const { data } = txCreate.mock.calls[0]![0] as {
        data: { rangeStart: bigint; rangeEnd: bigint };
      };
      expect(data.rangeStart).toBe(start);
      // rangeEnd = rangeStart + quantity - 1
      expect(data.rangeEnd).toBe(start + BigInt(baseInput.quantity) - BigInt(1));
    },
  );

  it("continues from the previous reservation's rangeEnd + 1", async () => {
    findUnique.mockResolvedValue(null);
    txFindFirst.mockResolvedValue({ rangeEnd: BigInt(100_049) });
    txCreate.mockImplementation(async ({ data }: { data: unknown }) => data);

    await atomicReserveSerialRange({
      ...baseInput,
      series: SerialSeries.LOCK_TAGS,
      purpose: "internal_print",
    });

    const { data } = txCreate.mock.calls[0]![0] as {
      data: { rangeStart: bigint; rangeEnd: bigint };
    };
    expect(data.rangeStart).toBe(BigInt(100_050));
    expect(data.rangeEnd).toBe(BigInt(100_099));
  });

  it("ignores out-of-band reservations when allocating the next range", async () => {
    findUnique.mockResolvedValue(null);
    txFindFirst.mockResolvedValue({ rangeEnd: BigInt(50) });
    txCreate.mockImplementation(async ({ data }: { data: unknown }) => data);

    await atomicReserveSerialRange({
      ...baseInput,
      series: SerialSeries.JEWELLERY_BARCODES,
      purpose: "internal_print",
    });

    const { data } = txCreate.mock.calls[0]![0] as {
      data: { rangeStart: bigint; rangeEnd: bigint };
    };
    expect(data.rangeStart).toBe(BigInt(1_000_000_000));
    expect(data.rangeEnd).toBe(BigInt(1_000_000_049));
  });
});

describe("atomicReserveSerialRange — serialization conflict retries", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function serializationError() {
    return new Prisma.PrismaClientKnownRequestError("write conflict", {
      code: "P2034",
      clientVersion: "test",
    });
  }

  it("retries a serialization conflict and succeeds on a later attempt", async () => {
    vi.useFakeTimers();
    findUnique.mockResolvedValue(null);
    const reservation = { id: "res-ok" };
    let calls = 0;
    $transaction.mockImplementation(async () => {
      calls += 1;
      if (calls < 2) throw serializationError();
      return reservation;
    });

    const promise = atomicReserveSerialRange({
      ...baseInput,
      series: SerialSeries.LOCK_TAGS,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ success: true, reservation });
    expect(calls).toBe(2);
  });

  it("returns the timeout message after exhausting all retries", async () => {
    vi.useFakeTimers();
    findUnique.mockResolvedValue(null);
    let calls = 0;
    $transaction.mockImplementation(async () => {
      calls += 1;
      throw serializationError();
    });

    const promise = atomicReserveSerialRange({
      ...baseInput,
      series: SerialSeries.LOCK_TAGS,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("took too long");
    }
    // initial attempt + 3 retries
    expect(calls).toBe(4);
  });

  it("retries P2028 transaction timeout and succeeds on a later attempt", async () => {
    vi.useFakeTimers();
    findUnique.mockResolvedValue(null);
    const reservation = { id: "res-ok" };
    let calls = 0;
    $transaction.mockImplementation(async () => {
      calls += 1;
      if (calls < 2) {
        throw new Prisma.PrismaClientKnownRequestError("Transaction not found", {
          code: "P2028",
          clientVersion: "test",
        });
      }
      return reservation;
    });

    const promise = atomicReserveSerialRange({
      ...baseInput,
      series: SerialSeries.LOCK_TAGS,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ success: true, reservation });
    expect(calls).toBe(2);
  });

  it("returns a non-retryable error immediately without retrying", async () => {
    findUnique.mockResolvedValue(null);
    let calls = 0;
    $transaction.mockImplementation(async () => {
      calls += 1;
      throw new Error("boom");
    });

    const result = await atomicReserveSerialRange({
      ...baseInput,
      series: SerialSeries.LOCK_TAGS,
    });

    expect(result).toEqual({ success: false, error: "boom" });
    expect(calls).toBe(1);
  });
});

describe("reserveSerialRangeInTransaction — vendor lock tags", () => {
  it("reserves with poId and does not transition PR to EXECUTED_PRINT", async () => {
    txPrFindUnique.mockResolvedValue({ id: "pr-1", status: PRStatus.APPROVED });
    txCreate.mockResolvedValue({ id: "res-vendor", poId: "po-1" });

    await reserveSerialRangeInTransaction(makeTx() as never, {
      ...baseInput,
      series: SerialSeries.LOCK_TAGS,
      poId: "po-1",
      idempotencyKey: "po-po-1-lock-tags",
      purpose: "vendor_lock_tags",
    });

    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          poId: "po-1",
          prId: null,
        }),
      }),
    );
    expect(txPrUpdate).not.toHaveBeenCalled();
  });

  it("rejects vendor reservation when PR is not approved", async () => {
    txPrFindUnique.mockResolvedValue({ id: "pr-1", status: PRStatus.PENDING_APPROVAL });

    await expect(
      reserveSerialRangeInTransaction(makeTx() as never, {
        ...baseInput,
        series: SerialSeries.LOCK_TAGS,
        poId: "po-1",
        idempotencyKey: "po-po-1-lock-tags",
        purpose: "vendor_lock_tags",
      }),
    ).rejects.toThrow(/approved/i);
  });
});

describe("atomicReserveSerialRange — ceiling enforcement", () => {
  it("returns a ceiling error when the range exceeds the configured ceiling", async () => {
    findUnique.mockResolvedValue(null);
    txSeriesConfigFindUnique.mockResolvedValue({
      ceilingNumber: BigInt(100_010),
    });

    const result = await atomicReserveSerialRange({
      ...baseInput,
      series: SerialSeries.LOCK_TAGS,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("ceiling");
    }
    expect(txCreate).not.toHaveBeenCalled();
  });

  it("uses default ceiling when DB ceiling is below series start (legacy seed)", async () => {
    findUnique.mockResolvedValue(null);
    txFindFirst.mockResolvedValue(null);
    txSeriesConfigFindUnique.mockResolvedValue({
      ceilingNumber: BigInt(9_000_000),
    });
    txCreate.mockResolvedValue({ id: "res-1" });

    const result = await atomicReserveSerialRange({
      ...baseInput,
      series: SerialSeries.JEWELLERY_BARCODES,
    });

    expect(result.success).toBe(true);
    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rangeStart: BigInt(1_000_000_000),
          rangeEnd: BigInt(1_000_000_049),
        }),
      }),
    );
  });
});
