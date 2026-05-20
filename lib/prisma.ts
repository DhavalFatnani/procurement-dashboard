import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Singleton Prisma client. With Supabase PgBouncer (DATABASE_URL + connection_limit=1),
 * run queries sequentially — see lib/db-serial.ts. Do not Promise.all multiple prisma calls.
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
