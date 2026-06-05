/**
 * Next.js instrumentation hook — runs once when the server boots.
 *
 * The dev server hot-reloads server modules, and several libraries in our
 * stack (sonic-boom via pino, Prisma) register an `exit` listener each time
 * a module re-initialises. Past ~10 reloads Node prints a
 * `MaxListenersExceededWarning`. Bumping the cap up here keeps the dev
 * console clean without masking a real leak (warnings still fire if listeners
 * cross the higher threshold).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.setMaxListeners(32);

    // Warm the pool at boot so a bad DATABASE_URL surfaces immediately in the terminal.
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.error(
        "[instrumentation] Database unreachable at startup — check DATABASE_URL and Supabase project status.",
        error instanceof Error ? error.message : error,
      );
    }
  }
}
