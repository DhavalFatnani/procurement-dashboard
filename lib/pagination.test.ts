import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  paginatedListQuery,
  parsePagination,
  toPaginated,
} from "./pagination";

describe("parsePagination", () => {
  it("defaults to page 1 and DEFAULT_PAGE_SIZE", () => {
    expect(parsePagination(undefined, undefined)).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
    });
  });

  it("clamps page to a minimum of 1", () => {
    expect(parsePagination("0").page).toBe(1);
    expect(parsePagination("-5").page).toBe(1);
    expect(parsePagination("not-a-number").page).toBe(1);
  });

  it("clamps pageSize to the [10, 100] range", () => {
    expect(parsePagination("1", "5").pageSize).toBe(10);
    expect(parsePagination("1", "1000").pageSize).toBe(100);
    expect(parsePagination("1", "40").pageSize).toBe(40);
  });

  it("computes skip from page and pageSize", () => {
    expect(parsePagination("3", "20").skip).toBe(40);
  });

  it("uses the first element when given an array", () => {
    expect(parsePagination(["2", "9"], ["30", "50"])).toEqual({
      page: 2,
      pageSize: 30,
      skip: 30,
    });
  });
});

describe("toPaginated", () => {
  it("computes totalPages and hasNextPage", () => {
    const result = toPaginated([1, 2], 45, 1, 20);
    expect(result.totalPages).toBe(3);
    expect(result.hasNextPage).toBe(true);
  });

  it("reports no next page on the last page", () => {
    const result = toPaginated([1, 2], 42, 3, 20);
    expect(result.hasNextPage).toBe(false);
  });

  it("always has at least one page", () => {
    expect(toPaginated([], 0, 1, 20).totalPages).toBe(1);
  });
});

describe("paginatedListQuery", () => {
  it("fetches pageSize + 1 to detect the next page (fast mode)", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([1, 2, 3, 4, 5, 6]); // 6 = pageSize(5) + 1
    const result = await paginatedListQuery<number>({
      page: 1,
      pageSize: 5,
      findMany,
    });

    expect(findMany).toHaveBeenCalledWith({ skip: 0, take: 6 });
    expect(result.items).toEqual([1, 2, 3, 4, 5]);
    expect(result.hasNextPage).toBe(true);
    expect(result.total).toBe(6); // estimated: page*pageSize + 1
    expect(result.totalPages).toBe(2);
  });

  it("reports no next page when fewer than pageSize + 1 returned", async () => {
    const findMany = vi.fn().mockResolvedValue([1, 2, 3]);
    const result = await paginatedListQuery<number>({
      page: 2,
      pageSize: 5,
      findMany,
    });

    expect(findMany).toHaveBeenCalledWith({ skip: 5, take: 6 });
    expect(result.hasNextPage).toBe(false);
    expect(result.total).toBe(8); // skip(5) + items(3)
    expect(result.totalPages).toBe(2);
  });

  it("runs an exact count when includeExactCount is set", async () => {
    const findMany = vi.fn().mockResolvedValue([1, 2, 3, 4, 5, 6]);
    const count = vi.fn().mockResolvedValue(123);
    const result = await paginatedListQuery<number>({
      page: 1,
      pageSize: 5,
      findMany,
      count,
      includeExactCount: true,
    });

    expect(count).toHaveBeenCalledOnce();
    expect(result.total).toBe(123);
    expect(result.totalPages).toBe(25);
  });

  it("skips count when includeExactCount is false even if count is provided", async () => {
    const findMany = vi.fn().mockResolvedValue([1, 2]);
    const count = vi.fn().mockResolvedValue(999);
    await paginatedListQuery<number>({
      page: 1,
      pageSize: 5,
      findMany,
      count,
      includeExactCount: false,
    });
    expect(count).not.toHaveBeenCalled();
  });
});
