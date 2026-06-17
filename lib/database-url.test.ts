import { describe, expect, it } from "vitest";

import {
  assertAppDatabaseUrl,
  isSessionPoolerDatabaseUrl,
} from "@/lib/database-url";

describe("isSessionPoolerDatabaseUrl", () => {
  it("detects session pooler port 5432", () => {
    expect(
      isSessionPoolerDatabaseUrl(
        "postgresql://user:pass@aws.pooler.supabase.com:5432/postgres",
      ),
    ).toBe(true);
  });

  it("allows transaction pooler port 6543", () => {
    expect(
      isSessionPoolerDatabaseUrl(
        "postgresql://user:pass@aws.pooler.supabase.com:6543/postgres?pgbouncer=true",
      ),
    ).toBe(false);
  });
});

describe("assertAppDatabaseUrl", () => {
  it("throws for session pooler URLs", () => {
    expect(() =>
      assertAppDatabaseUrl(
        "postgresql://user:pass@aws.pooler.supabase.com:5432/postgres",
      ),
    ).toThrow(/6543/);
  });

  it("accepts transaction pooler URLs", () => {
    expect(() =>
      assertAppDatabaseUrl(
        "postgresql://user:pass@aws.pooler.supabase.com:6543/postgres?pgbouncer=true",
      ),
    ).not.toThrow();
  });
});
