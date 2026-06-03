import { getDbConcurrency } from "@/lib/database-url";
import { usesSharedDbPooler } from "@/lib/db-parallel";

let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  const limit = getDbConcurrency();
  if (active < limit) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      active++;
      resolve();
    });
  });
}

function release(): void {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) {
    next();
  }
}

/** Limit concurrent Prisma queries when the DB URL uses a shared session pooler. */
export function withDbMutex<T>(fn: () => Promise<T>): Promise<T> {
  if (!usesSharedDbPooler()) {
    return fn();
  }
  return acquire().then(() =>
    fn().finally(() => {
      release();
    }),
  );
}

/** @internal Test helper */
export function resetDbMutexForTests() {
  active = 0;
  waiters.length = 0;
}
