import "server-only";

import { logger } from "@/lib/logger";

/**
 * Dev-only async timer. Wraps a server-side operation (a query, a loader) and
 * logs how long it took, so we can see DB time vs. render time during local
 * profiling. A no-op in production. Safe to remove once profiling is done.
 */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === "production") {
    return fn();
  }
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - start);
    logger.info({ label, ms }, `⏱  ${label}: ${ms}ms`);
  }
}
