import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase-env";

/**
 * Auth callback for recovery / invite / OAuth PKCE flows.
 *
 * Recovery emails must use token_hash (not PKCE code) when reset is triggered
 * server-side (admin createUser / sendPasswordReset). Update the Supabase
 * "Reset password" email template to:
 *
 *   {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery
 *   (RedirectTo targets /auth/verify-recovery — never verify token_hash in this route.)
 *
 * Set Supabase Auth → URL Configuration → Site URL to your production app
 * origin (e.g. https://procurement.example.com). Add each environment origin
 * (production, preview, http://localhost:3000) to Redirect URLs.
 *
 * Prefer `{{ .ConfirmationURL }}` in the reset-password email template so links
 * use the `redirectTo` origin from the app. Custom templates that hardcode
 * `{{ .SiteURL }}` will ignore per-request redirects and stay on localhost if
 * Site URL was never updated after local development.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextRaw = searchParams.get("next") ?? "/dashboard";
  const next = nextRaw.startsWith("/") ? nextRaw : "/dashboard";

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const loginError = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  let response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(`${origin}${next}`);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  if (token_hash && type) {
    // Do not verify here — chat apps prefetch /auth/callback links and would
    // consume one-time tokens before the recipient opens them.
    const verify = new URL(`${origin}/auth/verify-recovery`);
    verify.searchParams.set("token_hash", token_hash);
    verify.searchParams.set("type", type);
    verify.searchParams.set("next", next);
    return NextResponse.redirect(verify);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return loginError(error.message);
    }
    return response;
  }

  return loginError("Unable to complete sign-in. Please try again.");
}
