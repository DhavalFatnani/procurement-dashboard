import { afterEach, describe, expect, it } from "vitest";

import { canParallelizeQueries, usesSharedDbPooler } from "@/lib/db-parallel";

const envSnapshot = { ...process.env };

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe("usesSharedDbPooler", () => {
  it("detects Supabase session pooler query params", () => {
    expect(
      usesSharedDbPooler(
        "postgresql://user:pass@host/postgres?pgbouncer=true&connection_limit=5",
      ),
    ).toBe(true);
  });

  it("detects Supabase pooler hostnames", () => {
    expect(
      usesSharedDbPooler("postgresql://user:pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"),
    ).toBe(true);
  });

  it("detects transaction pooler port", () => {
    expect(usesSharedDbPooler("postgresql://user:pass@host:6543/postgres")).toBe(true);
  });

  it("returns false for direct Postgres URLs", () => {
    expect(usesSharedDbPooler("postgresql://user:pass@localhost:5432/postgres")).toBe(false);
  });
});

describe("canParallelizeQueries", () => {
  it("allows Accelerate URLs", () => {
    process.env.DATABASE_URL = "prisma://accelerate.example";
    expect(canParallelizeQueries()).toBe(true);
  });

  it("honors ALLOW_LOCAL_DB_PARALLEL on Supabase pooler URLs", () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@host/postgres?pgbouncer=true&connection_limit=5";
    process.env.ALLOW_LOCAL_DB_PARALLEL = "true";
    expect(canParallelizeQueries()).toBe(true);
  });

  it("allows local opt-in on direct Postgres URLs", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/postgres";
    process.env.ALLOW_LOCAL_DB_PARALLEL = "true";
    expect(canParallelizeQueries()).toBe(true);
  });

  it("defaults to serial on direct Postgres without opt-in", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/postgres";
    delete process.env.ALLOW_LOCAL_DB_PARALLEL;
    expect(canParallelizeQueries()).toBe(false);
  });
});
