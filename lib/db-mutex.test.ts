import { afterEach, describe, expect, it } from "vitest";

import { resetDbMutexForTests, withDbMutex } from "@/lib/db-mutex";

const envSnapshot = { ...process.env };

afterEach(() => {
  process.env = { ...envSnapshot };
  resetDbMutexForTests();
});

describe("withDbMutex", () => {
  it("runs without serialization on direct Postgres URLs", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/postgres";
    const order: number[] = [];
    const first = withDbMutex(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    const second = withDbMutex(async () => {
      order.push(2);
    });
    await Promise.all([first, second]);
    expect(order).toEqual([2, 1]);
  });

  it("serializes queries on Supabase pooler URLs", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@host/postgres?pgbouncer=true&connection_limit=5";
    const order: number[] = [];
    const first = withDbMutex(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    const second = withDbMutex(async () => {
      order.push(2);
    });
    await Promise.all([first, second]);
    expect(order).toEqual([1, 2]);
  });
});
