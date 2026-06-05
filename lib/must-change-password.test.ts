import { describe, expect, it } from "vitest";

import {
  MUST_CHANGE_PASSWORD_KEY,
  mustChangePassword,
} from "@/lib/must-change-password";

describe("mustChangePassword", () => {
  it("returns true when flag is explicitly true", () => {
    expect(mustChangePassword({ [MUST_CHANGE_PASSWORD_KEY]: true })).toBe(true);
  });

  it("returns false when flag is missing", () => {
    expect(mustChangePassword({})).toBe(false);
  });

  it("returns false when flag is false or non-boolean", () => {
    expect(mustChangePassword({ [MUST_CHANGE_PASSWORD_KEY]: false })).toBe(false);
    expect(mustChangePassword({ [MUST_CHANGE_PASSWORD_KEY]: "true" })).toBe(false);
  });
});
