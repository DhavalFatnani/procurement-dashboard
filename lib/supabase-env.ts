/**
 * Supabase project URL (same for publishable and secret clients).
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

/**
 * Low-privilege key for browser, middleware, and RSC (`sb_publishable_...`).
 * Falls back to legacy JWT anon key during migration.
 */
export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY for migration)",
    );
  }
  return key;
}

/**
 * When Supabase is not fully configured (e.g. fresh clone), middleware skips session work instead of throwing.
 */
export function tryGetSupabasePublishableConfig():
  | { url: string; publishableKey: string }
  | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    return null;
  }
  return { url, publishableKey };
}
