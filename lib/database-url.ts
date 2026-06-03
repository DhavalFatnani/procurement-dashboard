import { usesSharedDbPooler } from "@/lib/db-parallel";

const DEFAULT_POOLER_CONCURRENCY = 1;
const MAX_POOLER_CONCURRENCY = 10;

function parseConnectionLimit(databaseUrl: string): number | null {
  const match = databaseUrl.match(/(?:^|[?&])connection_limit=(\d+)/i);
  if (!match) {
    return null;
  }
  const n = Number.parseInt(match[1]!, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Effective Prisma pool slots when using a shared Supabase session pooler. */
export function getDbConcurrency(databaseUrl = process.env.DATABASE_URL ?? ""): number {
  if (!usesSharedDbPooler(databaseUrl)) {
    return MAX_POOLER_CONCURRENCY;
  }
  if (process.env.ALLOW_LOCAL_DB_PARALLEL === "true") {
    const fromUrl = parseConnectionLimit(databaseUrl);
    return Math.min(
      Math.max(fromUrl ?? DEFAULT_POOLER_CONCURRENCY, DEFAULT_POOLER_CONCURRENCY),
      MAX_POOLER_CONCURRENCY,
    );
  }
  return DEFAULT_POOLER_CONCURRENCY;
}

/** Cap Prisma pool usage on Supabase session mode; honor local parallel opt-in. */
export function resolveDatabaseUrl(databaseUrl = process.env.DATABASE_URL ?? ""): string {
  if (!usesSharedDbPooler(databaseUrl)) {
    return databaseUrl;
  }

  const allowParallel = process.env.ALLOW_LOCAL_DB_PARALLEL === "true";

  try {
    const normalized = databaseUrl.replace(/^postgresql:\/\//i, "postgres://");
    const url = new URL(normalized);
    if (!allowParallel) {
      url.searchParams.set("connection_limit", String(DEFAULT_POOLER_CONCURRENCY));
    } else if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "5");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", allowParallel ? "60" : "30");
    }
    return url.toString().replace(/^postgres:\/\//i, "postgresql://");
  } catch {
    return databaseUrl;
  }
}
