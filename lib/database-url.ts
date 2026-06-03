import { usesSharedDbPooler } from "@/lib/db-parallel";

/** Cap Prisma to one pooler slot on Supabase session mode. */
export function resolveDatabaseUrl(databaseUrl = process.env.DATABASE_URL ?? ""): string {
  if (!usesSharedDbPooler(databaseUrl)) {
    return databaseUrl;
  }

  try {
    const normalized = databaseUrl.replace(/^postgresql:\/\//i, "postgres://");
    const url = new URL(normalized);
    url.searchParams.set("connection_limit", "1");
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "30");
    }
    return url.toString().replace(/^postgres:\/\//i, "postgresql://");
  } catch {
    return databaseUrl;
  }
}
