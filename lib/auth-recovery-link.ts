import "server-only";

import {
  authCallbackRedirectUrl,
  buildRecoveryCallbackUrl,
  getSiteOrigin,
} from "@/lib/get-site-origin";
import { createServerSupabaseClient } from "@/lib/supabase";
import { tryCreateSecretSupabaseClient } from "@/lib/supabase-admin";

/** Sends Supabase's password-recovery email (uses project SMTP / rate limits). */
export async function sendPasswordResetEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const origin = await getSiteOrigin();
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackRedirectUrl(origin),
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not send password reset email.",
    };
  }
}

/**
 * Admin recovery link without sending email — fallback when SMTP send fails or
 * Ops needs to share the link manually.
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
