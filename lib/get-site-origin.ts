import { headers } from "next/headers";

/** App origin for auth redirect URLs (must match Supabase Auth → URL Configuration → Site URL). */
export async function getSiteOrigin(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envUrl) {
    return envUrl;
  }

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

/** Recovery email callback target after verifyOtp succeeds. */
export const AUTH_RECOVERY_NEXT_PATH = "/login/reset-password";

export function authCallbackRedirectUrl(origin: string, next = AUTH_RECOVERY_NEXT_PATH): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function buildRecoveryCallbackUrl(origin: string, hashedToken: string): string {
  return `${origin}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=${encodeURIComponent(AUTH_RECOVERY_NEXT_PATH)}`;
}
