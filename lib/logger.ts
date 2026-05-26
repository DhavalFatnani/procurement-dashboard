import "server-only";

import pino, { type Logger } from "pino";

/**
 * Server-side structured logger. Emits JSON to stdout (picked up by the host's
 * log drain). No transport/worker threads are configured so it bundles cleanly
 * for serverless/Fluid Compute. Set LOG_LEVEL to override the default.
 *
 * Cached on `globalThis` so Next.js dev HMR reuses one instance instead of
 * constructing a new logger on every server module reload — each construction
 * registers an `exit` listener on the Node process via sonic-boom, which
 * triggers the `MaxListenersExceededWarning` after ~11 hot reloads.
 */
const globalForLogger = globalThis as unknown as {
  __knotLogger: Logger | undefined;
};

function createLogger(): Logger {
  return pino({
    level:
      process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === "production" ? "info" : "debug"),
  });
}

export const logger: Logger = globalForLogger.__knotLogger ?? createLogger();

if (process.env.NODE_ENV !== "production") {
  globalForLogger.__knotLogger = logger;
}
