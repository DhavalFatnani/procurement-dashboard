import { dbSerial } from "@/lib/db-serial";

/**
 * True when Prisma can safely run concurrent queries (Accelerate or connection_limit > 1).
 * Transaction-mode PgBouncer with connection_limit=1 must stay serial — see lib/db-serial.ts.
 */
export function canParallelizeQueries(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("prisma://")) {
    return true;
  }
  const match = url.match(/connection_limit=(\d+)/i);
  if (match) {
    return parseInt(match[1]!, 10) > 1;
  }
  return false;
}

/** Run independent Prisma tasks in parallel when the pool allows it; otherwise serial. */
export async function dbParallel<T extends readonly unknown[]>(
  ...tasks: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  if (canParallelizeQueries()) {
    const results = await Promise.all(tasks.map((task) => task()));
    return results as unknown as T;
  }
  return (await dbSerial(...tasks)) as unknown as T;
}
