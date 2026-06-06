import { headers } from "next/headers";

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

/** Vercel-injected deployment URL (no protocol). */
function vercelDeploymentOrigin(): string | undefined {
  if (process.env.VERCEL !== "1") return undefined;

  if (process.env.VERCEL_ENV === "production") {
    const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (production) {
      return `https://${production.replace(/\/$/, "")}`;
    }
  }

  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) {
    return `https://${deployment.replace(/\/$/, "")}`;
  }

  return undefined;
}

/**
 * Resolve origin from env only (no request headers). Useful in tests and for
 * predictable Vercel production URLs when `NEXT_PUBLIC_SITE_URL` is missing
 * or still points at localhost.
 */
export function resolveSiteOriginFromEnv(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const onVercel = process.env.VERCEL === "1";

  if (configured && (!onVercel || !isLocalhostOrigin(configured))) {
    return configured;
  }

  const vercel = vercelDeploymentOrigin();
  if (vercel) return vercel;

  if (configured) return configured;

  return undefined;
}

/** App origin for auth redirect URLs (must match Supabase Auth → URL Configuration → Site URL). */
export async function getSiteOrigin(): Promise<string> {
  const fromEnv = resolveSiteOriginFromEnv();
  if (fromEnv) return fromEnv;

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (host) {
    const proto =
      headersList.get("x-forwarded-proto") ??
      (host.includes("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;
    if (!isLocalhostOrigin(origin)) {
      return origin;
    }
  }

  return "http://localhost:3000";
}

/** Recovery email callback target after verifyOtp succeeds. */
export const AUTH_RECOVERY_NEXT_PATH = "/login/reset-password";

/**
 * Landing page for recovery links. Does not consume the token on GET so chat-app
 * link previews (WhatsApp, Slack, etc.) cannot invalidate one-time links.
 */
export const AUTH_RECOVERY_VERIFY_PATH = "/auth/verify-recovery";

export function authCallbackRedirectUrl(origin: string, next = AUTH_RECOVERY_NEXT_PATH): string {
  return `${origin}${AUTH_RECOVERY_VERIFY_PATH}?next=${encodeURIComponent(next)}`;
}

export function buildRecoveryCallbackUrl(origin: string, hashedToken: string): string {
  return `${origin}${AUTH_RECOVERY_VERIFY_PATH}?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=${encodeURIComponent(AUTH_RECOVERY_NEXT_PATH)}`;
}
