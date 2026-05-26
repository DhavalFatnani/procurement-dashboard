import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getVerifiedIdentity } from "@/lib/auth-claims";
import { applyIdentityHeaders } from "@/lib/auth-headers";
import { defaultLandingFor } from "@/lib/navigation";
import { tryGetSupabasePublishableConfig } from "@/lib/supabase-env";
import { isRole } from "@/types";

const publicPaths = new Set(["/login", "/login/forgot-password", "/unauthorized"]);

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const config = tryGetSupabasePublishableConfig();
  if (!config) {
    return supabaseResponse;
  }

  const { url: supabaseUrl, publishableKey } = config;

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const authStart =
    process.env.NODE_ENV !== "production" ? performance.now() : 0;
  const user = await getVerifiedIdentity(supabase);
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `⏱  middleware.auth (${request.nextUrl.pathname}): ${Math.round(performance.now() - authStart)}ms`,
    );
  }

  if (user) {
    const requestHeaders = new Headers(request.headers);
    applyIdentityHeaders(requestHeaders, user);
    const withIdentity = NextResponse.next({
      request: { headers: requestHeaders },
    });
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      withIdentity.cookies.set(cookie);
    });
    supabaseResponse = withIdentity;
  }

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api") || pathname.startsWith("/auth/")) {
    return supabaseResponse;
  }

  if (user) {
    const rawRole =
      (user.userMetadata as Record<string, unknown>)?.role ??
      (user.appMetadata as Record<string, unknown>)?.role;
    const role = isRole(rawRole) ? rawRole : null;
    const landing = role ? defaultLandingFor(role) : "/dashboard";

    if (pathname === "/login" || pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = landing;
      return NextResponse.redirect(url);
    }
  }

  if (!user && !publicPaths.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
