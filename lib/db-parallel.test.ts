import { describe, expect, it } from "vitest";

import { dbParallel } from "@/lib/db-parallel";

describe("dbParallel", () => {
  it("returns results positionally as a typed tuple", async () => {
    const [a, b, c] = await dbParallel(
      async () => "a",
      async () => 2,
      async () => true,
    );
    expect(a).toBe("a");
    expect(b).toBe(2);
    expect(c).toBe(true);
  });

  it("runs tasks concurrently (does not serialize)", async () => {
    const started: number[] = [];
    let resolveFirst!: () => void;
    const first = new Promise<void>((r) => {
      resolveFirst = r;
    });

    const result = dbParallel(
      async () => {
        started.push(1);
        await first; // blocks until the second task signals
        return "first";
      },
      async () => {
        started.push(2);
        resolveFirst(); // only runs if the second task started before the first finished
        return "second";
      },
    );

    expect(await result).toEqual(["first", "second"]);
    // both tasks began before either completed → genuine concurrency
    expect(started).toEqual([1, 2]);
  });
});
