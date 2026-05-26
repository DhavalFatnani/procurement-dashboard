import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { revalidatePath, revalidateTag } from "next/cache";

import {
  revalidateCreatePOFromPR,
  revalidatePRStatusChange,
} from "@/lib/revalidate-tags";
import { LIST_CACHE_TAGS } from "@/lib/list-cache";

describe("revalidatePRStatusChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates PR detail, list, and inbox without PO tags by default", () => {
    revalidatePRStatusChange("PR-001");

    expect(revalidateTag).toHaveBeenCalledWith(`${LIST_CACHE_TAGS.prDetail}:PR-001`);
    expect(revalidateTag).toHaveBeenCalledWith(LIST_CACHE_TAGS.purchaseRequests);
    expect(revalidateTag).toHaveBeenCalledWith(LIST_CACHE_TAGS.inbox);
    expect(revalidateTag).not.toHaveBeenCalledWith(LIST_CACHE_TAGS.purchaseOrders);
    expect(revalidateTag).not.toHaveBeenCalledWith(LIST_CACHE_TAGS.awaitingPo);
    expect(revalidatePath).toHaveBeenCalledWith("/purchase-requests/PR-001");
    expect(revalidatePath).toHaveBeenCalledWith("/purchase-requests");
  });

  it("invalidates awaiting PO tags when affectsAwaitingPo is true", () => {
    revalidatePRStatusChange("PR-002", { affectsAwaitingPo: true });

    expect(revalidateTag).toHaveBeenCalledWith(LIST_CACHE_TAGS.awaitingPo);
    expect(revalidatePath).toHaveBeenCalledWith("/purchase-orders");
  });

  it("invalidates catalog when affectsCatalog is true", () => {
    revalidatePRStatusChange("PR-003", { affectsCatalog: true });

    expect(revalidateTag).toHaveBeenCalledWith("catalog-items");
    expect(revalidateTag).toHaveBeenCalledWith(LIST_CACHE_TAGS.catalog);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/catalog");
  });
});

describe("revalidateCreatePOFromPR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates PO and PR caches for createPOFromPR", () => {
    revalidateCreatePOFromPR("PR-10", "PO-20");

    expect(revalidateTag).toHaveBeenCalledWith(`${LIST_CACHE_TAGS.prDetail}:PR-10`);
    expect(revalidateTag).toHaveBeenCalledWith(`${LIST_CACHE_TAGS.poDetail}:PO-20`);
    expect(revalidateTag).toHaveBeenCalledWith(LIST_CACHE_TAGS.purchaseOrders);
    expect(revalidateTag).toHaveBeenCalledWith(LIST_CACHE_TAGS.awaitingPo);
    expect(revalidatePath).toHaveBeenCalledWith("/purchase-orders/PO-20");
  });
});
