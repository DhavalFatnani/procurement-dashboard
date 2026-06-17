import { describe, expect, it } from "vitest";

import { isTransientDbError } from "@/lib/db-retry";

describe("isTransientDbError", () => {
  it("treats session pool exhaustion as transient", () => {
    expect(
      isTransientDbError(
        new Error(
          "Error querying the database: FATAL: MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size",
        ),
      ),
    ).toBe(true);
    expect(
      isTransientDbError(new Error("(EMAXCONNSESSION) max clients reached in session mode")),
    ).toBe(true);
  });

  it("treats connection timeouts as transient", () => {
    expect(isTransientDbError(new Error("connection timeout"))).toBe(true);
  });

  it("does not treat validation errors as transient", () => {
    expect(isTransientDbError(new Error("Unique constraint failed"))).toBe(false);
  });
});
