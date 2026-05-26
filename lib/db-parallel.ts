import { dbSerial } from "@/lib/db-serial";

/**
 * True only for Prisma Accelerate (`prisma://`). Session/direct Postgres URLs must
 * stay serial — Supabase session pooler shares a small global pool across all
 * serverless invocations (`max clients reached in session mode`).
 */
export function canParallelizeQueries(): boolean {
  return (process.env.DATABASE_URL ?? "").startsWith("prisma://");
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
