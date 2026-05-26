import { ExecutionType, PRStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  parsePurchaseOrderPageParams,
  parsePurchaseRequestPageParams,
  parsePurchaseRequestSearchParams,
} from "./list-search-params";

describe("parsePurchaseRequestPageParams", () => {
  it("returns empty defaults for empty params", () => {
    expect(parsePurchaseRequestPageParams({})).toEqual({
      statuses: [],
      categoryId: "",
      subcategoryId: "",
      executionType: "",
      executionTypeParsed: undefined,
      warehouseId: "",
      createdById: "",
      dateFrom: "",
      dateTo: "",
      page: 1,
      includeExactCount: false,
    });
  });

  it("collects multiple valid statuses and drops invalid ones", () => {
    const parsed = parsePurchaseRequestPageParams({
      status: [PRStatus.DRAFT, "NONSENSE", PRStatus.APPROVED],
    });
    expect(parsed.statuses).toEqual([PRStatus.DRAFT, PRStatus.APPROVED]);
  });

  it("accepts a single status string", () => {
    expect(parsePurchaseRequestPageParams({ status: PRStatus.REJECTED }).statuses).toEqual([
      PRStatus.REJECTED,
    ]);
  });

  it("treats non-status array values as empty (page semantics)", () => {
    const parsed = parsePurchaseRequestPageParams({
      categoryId: ["a", "b"],
      warehouseId: ["w1"],
    });
    expect(parsed.categoryId).toBe("");
    expect(parsed.warehouseId).toBe("");
  });

  it("parses a valid executionType and ignores invalid ones", () => {
    expect(
      parsePurchaseRequestPageParams({ executionType: ExecutionType.INTERNAL_PRINT })
        .executionTypeParsed,
    ).toBe(ExecutionType.INTERNAL_PRINT);
    expect(
      parsePurchaseRequestPageParams({ executionType: "BOGUS" }).executionTypeParsed,
    ).toBeUndefined();
    // raw is preserved regardless
    expect(parsePurchaseRequestPageParams({ executionType: "BOGUS" }).executionType).toBe(
      "BOGUS",
    );
  });

  it("clamps page to a minimum of 1", () => {
    expect(parsePurchaseRequestPageParams({ page: "0" }).page).toBe(1);
    expect(parsePurchaseRequestPageParams({ page: "abc" }).page).toBe(1);
    expect(parsePurchaseRequestPageParams({ page: "4" }).page).toBe(4);
  });

  it("enables exact count only for exactCount=1", () => {
    expect(parsePurchaseRequestPageParams({ exactCount: "1" }).includeExactCount).toBe(true);
    expect(parsePurchaseRequestPageParams({ exactCount: "0" }).includeExactCount).toBe(false);
  });

  it("agrees with the URLSearchParams parser for single-valued inputs", () => {
    const record = {
      status: PRStatus.DRAFT,
      categoryId: "cat-1",
      subcategoryId: "sub-1",
      executionType: ExecutionType.VENDOR_PURCHASE,
      warehouseId: "wh-1",
      createdById: "user-1",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01",
      page: "3",
      exactCount: "1",
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(record)) params.set(k, v as string);

    expect(parsePurchaseRequestPageParams(record)).toEqual(
      parsePurchaseRequestSearchParams(params),
    );
  });
});

describe("parsePurchaseOrderPageParams", () => {
  it("parses fulfill query for PO creation from approved PR", () => {
    expect(parsePurchaseOrderPageParams({ fulfill: "PR-clxyz123" }).fulfill).toBe(
      "PR-clxyz123",
    );
  });
});
