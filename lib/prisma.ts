import "server-only";

import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

/**
 * Singleton Prisma client extended with Accelerate.
 *
 * - In production (`DATABASE_URL` = a `prisma://` Accelerate URL), queries run
 *   through Accelerate's warm global connection pool, eliminating per-invocation
 *   connection setup on serverless.
 * - Locally / with a direct `postgresql://` URL, Accelerate is a no-op pass-through
 *   and queries go straight to the database via the query engine.
 *
 * With Supabase PgBouncer (`connection_limit=1`), run queries sequentially —
 * see lib/db-serial.ts. Do not Promise.all multiple prisma calls.
 */
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends(withAccelerate());
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
