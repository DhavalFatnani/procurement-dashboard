import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase-env";

function getSupabaseSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY for migration)",
    );
  }
  return key;
}

/**
 * Elevated Supabase client (`sb_secret_...`) — uses the `service_role` DB role and bypasses RLS.
 * Use only in trusted server code (admin routes, cron, webhooks). Never import from client components.
 */
export function createSecretSupabaseClient() {
  return createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type SecretSupabaseClientResult =
  | { ok: true; client: ReturnType<typeof createSecretSupabaseClient> }
  | { ok: false; message: string };

/** Non-throwing variant for user-facing server actions (missing env surfaces as a toast, not a digest). */
export function tryCreateSecretSupabaseClient(): SecretSupabaseClientResult {
  try {
    return { ok: true, client: createSecretSupabaseClient() };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message:
        detail.includes("SUPABASE_SECRET_KEY") || detail.includes("SERVICE_ROLE")
          ? "Server is missing SUPABASE_SECRET_KEY — add the Supabase secret key to production env vars."
          : detail.includes("NEXT_PUBLIC_SUPABASE_URL")
            ? "Server is missing NEXT_PUBLIC_SUPABASE_URL."
            : "Could not initialize Supabase admin client.",
    };
  }
}
