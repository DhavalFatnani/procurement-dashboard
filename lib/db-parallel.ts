import { getDbConcurrency } from "@/lib/database-url";
import { dbSerial } from "@/lib/db-serial";

/** Supabase pooler URLs share a small global session pool — never fan out locally. */
export function usesSharedDbPooler(databaseUrl = process.env.DATABASE_URL ?? ""): boolean {
  return (
    /pgbouncer=true/i.test(databaseUrl) ||
    /pooler\.supabase\.com/i.test(databaseUrl) ||
    /:6543\//.test(databaseUrl)
  );
}

/**
 * True for Prisma Accelerate (`prisma://`) or explicit local opt-in on a direct Postgres URL.
 * Supabase pooler URLs stay serial regardless of `ALLOW_LOCAL_DB_PARALLEL`.
 */
export function canParallelizeQueries(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("prisma://")) {
    return true;
  }
  if (usesSharedDbPooler(url)) {
    return process.env.ALLOW_LOCAL_DB_PARALLEL === "true";
  }
  return process.env.ALLOW_LOCAL_DB_PARALLEL === "true";
}

/** Run independent Prisma tasks in parallel when the pool allows it; otherwise serial. */
export async function dbParallel<T extends readonly unknown[]>(
  ...tasks: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  if (canParallelizeQueries()) {
    const poolCap = getDbConcurrency();
    const capped =
      process.env.ALLOW_LOCAL_DB_PARALLEL === "true" &&
      !(process.env.DATABASE_URL ?? "").startsWith("prisma://")
        ? tasks.slice(0, poolCap)
        : tasks;
    const results = await Promise.all(capped.map((task) => task()));
    if (capped.length < tasks.length) {
      const rest = await dbSerial(...tasks.slice(LOCAL_PARALLEL_CAP));
      return [...results, ...rest] as unknown as T;
    }
    return results as unknown as T;
  }
  return (await dbSerial(...tasks)) as unknown as T;
}
