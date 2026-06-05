import { describe, expect, it } from "vitest";

import { authCallbackRedirectUrl, buildRecoveryCallbackUrl } from "@/lib/get-site-origin";

describe("authCallbackRedirectUrl", () => {
  it("builds callback URL with encoded next path", () => {
    expect(authCallbackRedirectUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback?next=%2Flogin%2Freset-password",
    );
  });
});

describe("buildRecoveryCallbackUrl", () => {
  it("builds a callback URL with token_hash and recovery type", () => {
    const url = buildRecoveryCallbackUrl("http://localhost:3000", "abc123");
    expect(url).toContain("http://localhost:3000/auth/callback");
    expect(url).toContain("token_hash=abc123");
    expect(url).toContain("type=recovery");
    expect(url).toContain("next=%2Flogin%2Freset-password");
  });
});
