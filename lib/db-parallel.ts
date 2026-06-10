import { isTransientDbError } from "@/lib/db-retry";

/**
 * Run independent Prisma tasks concurrently.
 *
 * The app talks to Postgres through a node-postgres connection pool (see
 * lib/prisma.ts), so the pool itself bounds real concurrency — fanning out with
 * Promise.all is always safe. Tasks beyond the pool's `max` simply queue.
 *
 * Kept as a named helper (rather than inlining Promise.all at call sites) so the
 * concurrency strategy stays in one place and the query files read declaratively.
 */
async function runParallel<T extends readonly unknown[]>(
  tasks: { [K in keyof T]: () => Promise<T[K]> },
): Promise<T> {
  return Promise.all(tasks.map((task) => task())) as unknown as T;
}

export async function dbParallel<T extends readonly unknown[]>(
  ...tasks: { [K in keyof T]: () => Promise<T[K]> }
): Promise<T> {
  try {
    return await runParallel(tasks);
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 400));
    return runParallel(tasks);
  }
}
