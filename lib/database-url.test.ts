import { describe, expect, it } from "vitest";

import { resolveDatabaseUrl } from "@/lib/database-url";

describe("resolveDatabaseUrl", () => {
  it("forces connection_limit=1 on Supabase pooler URLs", () => {
    const resolved = resolveDatabaseUrl(
      "postgresql://user:pass@host/postgres?pgbouncer=true&connection_limit=5&pool_timeout=30",
    );
    expect(resolved).toContain("connection_limit=1");
    expect(resolved).not.toContain("connection_limit=5");
    expect(resolved).toContain("pool_timeout=30");
  });

  it("leaves direct Postgres URLs unchanged", () => {
    const url = "postgresql://user:pass@localhost:5432/postgres";
    expect(resolveDatabaseUrl(url)).toBe(url);
  });
});
