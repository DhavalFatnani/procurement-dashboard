import { PRStatus, Role } from "@/lib/prisma-enums";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { getLockTagsSerialPreviewForPRQuery } from "@/lib/serial-preview";
import type { SessionUser } from "@/lib/session";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    purchaseRequest: { findUnique: vi.fn() },
    serialReservation: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/cache", () => ({
  getCachedSeriesRegistry: vi.fn().mockResolvedValue(new Map()),
}));

import { prisma } from "@/lib/prisma";

function session(role: Role): SessionUser {
  return {
    id: "user-1",
    email: "u@test.com",
    user_metadata: {},
    app_metadata: {},
    role,
    warehouseId: "w1",
    warehouseIds: ["w1"],
  };
}

describe("getLockTagsSerialPreviewForPRQuery", () => {
  beforeEach(() => {
    vi.mocked(prisma.purchaseRequest.findUnique).mockReset();
    vi.mocked(prisma.serialReservation.findFirst).mockReset();
  });

  it("returns null when the user cannot view the PR", async () => {
    vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
      executionType: "VENDOR_PURCHASE",
      status: PRStatus.APPROVED,
      warehouseId: "w2",
      createdById: "other",
      lines: [],
    } as never);

    const result = await getLockTagsSerialPreviewForPRQuery(
      session(Role.CENTRAL_TEAM),
      "pr-1",
    );

    expect(result).toBeNull();
    expect(prisma.serialReservation.findFirst).not.toHaveBeenCalled();
  });

  it("allows Central Team to load preview for in-scope vendor PRs", async () => {
    vi.mocked(prisma.purchaseRequest.findUnique).mockResolvedValue({
      executionType: "VENDOR_PURCHASE",
      status: PRStatus.APPROVED,
      warehouseId: "w1",
      createdById: "other",
      lines: [
        {
          category: { name: "Lock Tags" },
          items: [{ id: "item-1", quantity: 5 }],
        },
      ],
    } as never);
    vi.mocked(prisma.serialReservation.findFirst).mockResolvedValue({
      rangeEnd: BigInt(105),
      rangeStart: BigInt(101),
      quantity: 5,
      series: "LOCK_TAGS",
      status: "PENDING",
      prId: "pr-1",
      poId: null,
    } as never);

    const result = await getLockTagsSerialPreviewForPRQuery(
      session(Role.CENTRAL_TEAM),
      "pr-1",
    );

    expect(result).not.toBeNull();
    expect(result?.isHeld).toBe(true);
  });
});
