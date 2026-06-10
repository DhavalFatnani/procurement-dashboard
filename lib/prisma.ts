import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Singleton Prisma 7 client backed by a node-postgres (`pg`) connection pool
 * that talks directly to Supabase.
 *
 * - `DATABASE_URL` is Supabase's transaction pooler (port 6543), which is built
 *   for serverless: it multiplexes many short-lived client connections onto a
 *   small set of real Postgres connections. The per-instance `pg` pool below
 *   therefore stays small; independent queries run concurrently up to `max` and
 *   queue beyond it (so `dbParallel` can fan out safely — the pool is the
 *   concurrency control, no app-level mutex needed).
 * - Migrations use `DIRECT_URL` (session pooler) via prisma.config.ts.
 *
 * `DB_POOL_MAX` lets you tune connections-per-instance without a code change.
 */
// Dashboard/detail pages fan out ~10+ independent queries at once; a pool of 5
// makes them queue (and, on a cold connection to a distant DB, each waiter also
// pays a TLS handshake). 10 lets a page's burst run concurrently. Supabase's
// transaction pooler multiplexes these, so it stays well within its client cap.
const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 10);

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase transaction pooler URL (port 6543) to .env.local.",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    max: POOL_MAX,
    // Supabase's shared pooler terminates TLS but its certificate SAN does not
    // match the per-project host, so chain verification must be relaxed (the
    // connection is still encrypted). This is the documented Supabase + node-pg
    // setting.
    ssl: { rejectUnauthorized: false },
    // Remote pooler (Sydney from India) can see brief blips; keep sockets warm and
    // fail fast instead of hanging, then recycle idle clients before they go stale.
    keepAlive: true,
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 20_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
