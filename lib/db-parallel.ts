import { dbSerial } from "@/lib/db-serial";

const LOCAL_PARALLEL_CAP = 2;

/**
 * True for Prisma Accelerate (`prisma://`) or explicit local opt-in.
 * Direct Supabase session pooler URLs stay serial by default — small global pool.
 */
export function canParallelizeQueries(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("prisma://")) {
    return true;
  }
  return process.env.ALLOW_LOCAL_DB_PARALLEL === "true";
}

/** Run independent Prisma tasks in parallel when the pool allows it; otherwise serial. */
export async function dbParallel<T extends readonly unknown[]>(
  ...tasks: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  if (canParallelizeQueries()) {
    const capped =
      process.env.ALLOW_LOCAL_DB_PARALLEL === "true" &&
      !(process.env.DATABASE_URL ?? "").startsWith("prisma://")
        ? tasks.slice(0, LOCAL_PARALLEL_CAP)
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
