import "server-only";

import {
  authCallbackRedirectUrl,
  buildRecoveryCallbackUrl,
  getSiteOrigin,
} from "@/lib/get-site-origin";
import { tryCreateSecretSupabaseClient } from "@/lib/supabase-admin";

/**
 * Admin recovery link without sending email — avoids Supabase built-in SMTP rate limits.
 * Ops shares the returned URL with the user (chat, in person, etc.).
 */
export async function generateAdminRecoveryLink(
  email: string,
): Promise<{ ok: true; link: string } | { ok: false; message: string }> {
  try {
    const admin = tryCreateSecretSupabaseClient();
    if (!admin.ok) {
      return { ok: false, message: admin.message };
    }

    const origin = await getSiteOrigin();

    const { data, error } = await admin.client.auth.admin.generateLink({
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
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not generate recovery link.",
    };
  }
}
