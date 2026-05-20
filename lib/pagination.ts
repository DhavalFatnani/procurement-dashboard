export const DEFAULT_PAGE_SIZE = 25;

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  };
}
