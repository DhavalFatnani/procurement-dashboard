import type { SupabaseClient } from "@supabase/supabase-js";

/** Minimal authenticated identity, sourced from the JWT (or getUser fallback). */
export type VerifiedIdentity = {
  id: string;
  email: string | null;
  userMetadata: Record<string, unknown>;
  appMetadata: Record<string, unknown>;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * Resolves the authenticated identity, preferring LOCAL JWT verification
 * (`getClaims` — verifies the token signature against the project's signing
 * keys with no network round-trip) and falling back to the network `getUser()`
 * when local verification isn't available (e.g. asymmetric/ES256 signing keys
 * not yet enabled, or an expired token needing refresh). This keeps behavior
 * identical before and after ES256 is turned on — only the latency changes.
 */
export async function getVerifiedIdentity(
  supabase: SupabaseClient,
): Promise<VerifiedIdentity | null> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims as Record<string, unknown> | undefined;
    const sub = claims && typeof claims.sub === "string" ? claims.sub : null;
    if (!error && sub) {
      return {
        id: sub,
        email: typeof claims!.email === "string" ? (claims!.email as string) : null,
        userMetadata: toRecord(claims!.user_metadata),
        appMetadata: toRecord(claims!.app_metadata),
      };
    }
  } catch {
    // fall through to network verification
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  const user = data.user;
  return {
    id: user.id,
    email: user.email ?? null,
    userMetadata: toRecord(user.user_metadata),
    appMetadata: toRecord(user.app_metadata),
  };
}
