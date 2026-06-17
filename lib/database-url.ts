/** Returns true when the URL targets Supabase session pooler (port 5432). */
export function isSessionPoolerDatabaseUrl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString.replace(/^postgresql:/, "postgres:"));
    return url.port === "5432";
  } catch {
    return /:5432(\/|$|\?)/.test(connectionString);
  }
}

/**
 * App runtime must use the transaction pooler (port 6543).
 * Session pooler (5432) is for DIRECT_URL / migrations only.
 */
export function assertAppDatabaseUrl(connectionString: string): void {
  if (isSessionPoolerDatabaseUrl(connectionString)) {
    throw new Error(
      "DATABASE_URL must use Supabase transaction pooler port 6543 (?pgbouncer=true), not session pooler port 5432. Use DIRECT_URL for migrations.",
    );
  }
}
