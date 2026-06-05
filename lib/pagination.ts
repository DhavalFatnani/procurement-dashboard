import { withDbRetry } from "@/lib/db-retry";

export const DEFAULT_PAGE_SIZE = 25;

export type Paginated<T> = {
  items: T[];
  /** null when exact count was skipped for speed */
  total: number | null;
  page: number;
  pageSize: number;
  totalPages: number | null;
  hasNextPage: boolean;
};

export function parsePagination(
  pageRaw?: string | string[],
  pageSizeRaw?: string | string[],
): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, Number(Array.isArray(pageRaw) ? pageRaw[0] : pageRaw) || 1);
  const pageSize = Math.min(
    100,
    Math.max(10, Number(Array.isArray(pageSizeRaw) ? pageSizeRaw[0] : pageSizeRaw) || DEFAULT_PAGE_SIZE),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function toPaginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasNextPage: page * pageSize < total,
  };
}

/** Single findMany (+ optional count). Default skips COUNT for faster remote DB. */
export async function paginatedListQuery<T>({
  page,
  pageSize,
  findMany,
  count,
  includeExactCount = false,
}: {
  page: number;
  pageSize: number;
  findMany: (args: { skip: number; take: number }) => Promise<T[]>;
  count?: () => Promise<number>;
  includeExactCount?: boolean;
}): Promise<Paginated<T>> {
  const skip = (page - 1) * pageSize;
  const raw = await withDbRetry(() => findMany({ skip, take: pageSize + 1 }));
  const hasNextPage = raw.length > pageSize;
  const items = hasNextPage ? raw.slice(0, pageSize) : raw;

  if (includeExactCount && count) {
    const total = await count();
    return toPaginated(items, total, page, pageSize);
  }

  const estimatedTotal = hasNextPage
    ? page * pageSize + 1
    : skip + items.length;

  return {
    items,
    total: estimatedTotal,
    page,
    pageSize,
    totalPages: hasNextPage ? page + 1 : page,
    hasNextPage,
  };
}
