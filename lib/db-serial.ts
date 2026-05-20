import type { Paginated } from "@/lib/pagination";
import { toPaginated } from "@/lib/pagination";

/**
 * Supabase transaction-mode PgBouncer (DATABASE_URL with connection_limit=1) allows
 * only one query at a time per Prisma client. Never use Promise.all for multiple
 * Prisma calls — run them sequentially instead.
 */
export async function dbSerial<T extends readonly unknown[]>(
  ...tasks: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  const results = [] as { -readonly [K in keyof T]: T[K] };
  for (let i = 0; i < tasks.length; i++) {
    results[i as keyof T] = await tasks[i]!();
  }
  return results as T;
}

export async function paginatedQuery<T>({
  page,
  pageSize,
  count,
  findMany,
}: {
  page: number;
  pageSize: number;
  count: () => Promise<number>;
  findMany: () => Promise<T[]>;
}): Promise<Paginated<T>> {
  const total = await count();
  const items = await findMany();
  return toPaginated(items, total, page, pageSize);
}
