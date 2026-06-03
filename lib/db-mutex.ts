import { usesSharedDbPooler } from "@/lib/db-parallel";

let chain: Promise<unknown> = Promise.resolve();

/** Serialize Prisma queries when the DB URL uses a shared session pooler. */
export function withDbMutex<T>(fn: () => Promise<T>): Promise<T> {
  if (!usesSharedDbPooler()) {
    return fn();
  }
  const next = chain.then(fn, fn);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** @internal Test helper */
export function resetDbMutexForTests() {
  chain = Promise.resolve();
}
