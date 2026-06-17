import { Role } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import { landingPathForAuthUser } from "@/lib/auth-landing";
import { FINANCE_ROUTES } from "@/lib/finance-routes";

describe("landingPathForAuthUser", () => {
  it("returns role landing when metadata includes a valid role", () => {
    expect(
      landingPathForAuthUser({
        user_metadata: { role: Role.CENTRAL_TEAM },
        app_metadata: {},
      }),
    ).toBe("/dashboard");
    expect(
      landingPathForAuthUser({
        user_metadata: { role: Role.FINANCE },
        app_metadata: {},
      }),
    ).toBe(FINANCE_ROUTES.invoiceSettlement);
    expect(
      landingPathForAuthUser({
        user_metadata: { role: Role.ADMIN },
        app_metadata: {},
      }),
    ).toBe("/admin/platform");
  });

  it("falls back to dashboard when signed in without a role", () => {
    expect(
      landingPathForAuthUser({
        user_metadata: {},
        app_metadata: {},
      }),
    ).toBe("/dashboard");
  });

  it("sends missing user to login", () => {
    expect(landingPathForAuthUser(null)).toBe("/login");
  });
});
