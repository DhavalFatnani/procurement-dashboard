import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authCallbackRedirectUrl,
  buildRecoveryCallbackUrl,
  resolveSiteOriginFromEnv,
} from "@/lib/get-site-origin";

const ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

function saveEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("resolveSiteOriginFromEnv", () => {
  let envSnapshot: Record<string, string | undefined>;

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.unstubAllEnvs();
  });

  it("prefers NEXT_PUBLIC_SITE_URL when set to a public origin", () => {
    envSnapshot = saveEnv();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://procurement.knot.com");
    expect(resolveSiteOriginFromEnv()).toBe("https://procurement.knot.com");
  });

  it("ignores localhost NEXT_PUBLIC_SITE_URL on Vercel and uses production domain", () => {
    envSnapshot = saveEnv();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "procurement.knot.com");
    expect(resolveSiteOriginFromEnv()).toBe("https://procurement.knot.com");
  });

  it("falls back to VERCEL_URL on preview deployments", () => {
    envSnapshot = saveEnv();
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "knot-procurement-git-main-knot.vercel.app");
    expect(resolveSiteOriginFromEnv()).toBe(
      "https://knot-procurement-git-main-knot.vercel.app",
    );
  });

  it("keeps localhost NEXT_PUBLIC_SITE_URL for local development", () => {
    envSnapshot = saveEnv();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(resolveSiteOriginFromEnv()).toBe("http://localhost:3000");
  });
});

describe("authCallbackRedirectUrl", () => {
  it("builds callback URL with encoded next path", () => {
    expect(authCallbackRedirectUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/verify-recovery?next=%2Flogin%2Freset-password",
    );
  });
});

describe("buildRecoveryCallbackUrl", () => {
  it("builds a callback URL with token_hash and recovery type", () => {
    const url = buildRecoveryCallbackUrl("http://localhost:3000", "abc123");
    expect(url).toContain("http://localhost:3000/auth/verify-recovery");
    expect(url).toContain("token_hash=abc123");
    expect(url).toContain("type=recovery");
    expect(url).toContain("next=%2Flogin%2Freset-password");
  });
});
