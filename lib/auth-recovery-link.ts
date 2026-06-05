import "server-only";

import {
  authCallbackRedirectUrl,
  buildRecoveryCallbackUrl,
  getSiteOrigin,
} from "@/lib/get-site-origin";
import { createSecretSupabaseClient } from "@/lib/supabase-admin";

/**
 * Admin recovery link without sending email — avoids Supabase built-in SMTP rate limits.
 * Ops shares the returned URL with the user (chat, in person, etc.).
 */
export async function generateAdminRecoveryLink(
  email: string,
): Promise<{ ok: true; link: string } | { ok: false; message: string }> {
  const supabase = createSecretSupabaseClient();
  const origin = await getSiteOrigin();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: authCallbackRedirectUrl(origin),
    },
  });

  const hashedToken = data?.properties?.hashed_token;
  if (error || !hashedToken) {
    return {
      ok: false,
      message: error?.message ?? "Could not generate recovery link.",
    };
  }

  return { ok: true, link: buildRecoveryCallbackUrl(origin, hashedToken) };
}
