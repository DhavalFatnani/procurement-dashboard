import "server-only";

import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

import { usesSharedDbPooler } from "@/lib/db-parallel";
import { resolveDatabaseUrl } from "@/lib/database-url";
import { withDbMutex } from "@/lib/db-mutex";

/**
 * Singleton Prisma client extended with Accelerate.
 *
 * - In production (`DATABASE_URL` = a `prisma://` Accelerate URL), queries run
 *   through Accelerate's warm global connection pool, eliminating per-invocation
 *   connection setup on serverless.
 * - Locally / with a direct `postgresql://` URL, Accelerate is a no-op pass-through
 *   and queries go straight to the database via the query engine.
 *
 * With Supabase PgBouncer (session pooler), Prisma uses `connection_limit=1` and a
 * process-wide query mutex so Suspense boundaries cannot exhaust the shared pool.
 */
function createPrismaClient() {
  const base = new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  const withPoolerGuard = usesSharedDbPooler()
    ? base.$extends({
        query: {
          $allModels: {
            async $allOperations({ args, query }) {
              return withDbMutex(() => query(args));
            },
          },
        },
      })
    : base;

  return withPoolerGuard.$extends(withAccelerate());
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
