import { Role } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import { canAccessConfigurePO } from "@/lib/admin-access";

describe("canAccessConfigurePO", () => {
  it("allows Central Team, Ops Head, and Admin", () => {
    expect(canAccessConfigurePO(Role.CENTRAL_TEAM)).toBe(true);
    expect(canAccessConfigurePO(Role.OPS_HEAD)).toBe(true);
    expect(canAccessConfigurePO(Role.ADMIN)).toBe(true);
  });

  it("denies SM and Finance", () => {
    expect(canAccessConfigurePO(Role.SM)).toBe(false);
    expect(canAccessConfigurePO(Role.FINANCE)).toBe(false);
  });
});
