import { afterEach, describe, expect, it } from "vitest";

import { getDbConcurrency, resolveDatabaseUrl } from "@/lib/database-url";

const envSnapshot = { ...process.env };

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe("resolveDatabaseUrl", () => {
  const poolerUrl =
    "postgresql://user:pass@host/postgres?pgbouncer=true&connection_limit=5&pool_timeout=30";

  it("forces connection_limit=1 on Supabase pooler URLs by default", () => {
    delete process.env.ALLOW_LOCAL_DB_PARALLEL;
    const resolved = resolveDatabaseUrl(poolerUrl);
    expect(resolved).toContain("connection_limit=1");
    expect(resolved).not.toContain("connection_limit=5");
    expect(resolved).toContain("pool_timeout=30");
  });

  it("preserves connection_limit when ALLOW_LOCAL_DB_PARALLEL is set", () => {
    process.env.ALLOW_LOCAL_DB_PARALLEL = "true";
    const resolved = resolveDatabaseUrl(poolerUrl);
    expect(resolved).toContain("connection_limit=5");
    expect(resolved).not.toContain("connection_limit=1");
    expect(resolved).toContain("pool_timeout=30");
  });

  it("leaves direct Postgres URLs unchanged", () => {
    const url = "postgresql://user:pass@localhost:5432/postgres";
    expect(resolveDatabaseUrl(url)).toBe(url);
  });
});

describe("getDbConcurrency", () => {
  it("returns 1 on pooler URLs without parallel opt-in", () => {
    delete process.env.ALLOW_LOCAL_DB_PARALLEL;
    expect(
      getDbConcurrency(
        "postgresql://user:pass@host/postgres?pgbouncer=true&connection_limit=5",
      ),
    ).toBe(1);
  });

  it("reads connection_limit from pooler URL when parallel opt-in is set", () => {
    process.env.ALLOW_LOCAL_DB_PARALLEL = "true";
    expect(
      getDbConcurrency(
        "postgresql://user:pass@host/postgres?pgbouncer=true&connection_limit=5",
      ),
    ).toBe(5);
  });
});
