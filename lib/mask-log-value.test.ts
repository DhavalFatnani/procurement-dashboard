import { describe, expect, it } from "vitest";

import { maskLogValue } from "./mask-log-value";

describe("maskLogValue", () => {
  it("preserves null and undefined as null", () => {
    expect(maskLogValue("accountNumber", null)).toBeNull();
    expect(maskLogValue("accountNumber", undefined)).toBeNull();
  });

  it("preserves empty strings", () => {
    expect(maskLogValue("accountNumber", "")).toBe("");
  });

  it("masks accountNumber to a bulleted last-4", () => {
    expect(maskLogValue("accountNumber", "1234567890")).toBe("••••7890");
  });

  it("masks any field whose name contains 'account' (case-insensitive)", () => {
    expect(maskLogValue("bankAccountNo", "9876543210")).toBe("••••3210");
    expect(maskLogValue("ACCOUNT", "5555")).toBe("••••5555");
  });

  it("strips non-digits before taking the last 4 digits", () => {
    expect(maskLogValue("accountNumber", "12-34-56-7890")).toBe("••••7890");
  });

  it("falls back to the raw last-4 when an account field has no digits", () => {
    expect(maskLogValue("accountName", "abcdef")).toBe("••••cdef");
  });

  it("passes through non-account fields unchanged", () => {
    expect(maskLogValue("phone", "9998887776")).toBe("9998887776");
    expect(maskLogValue("email", "a@b.com")).toBe("a@b.com");
  });
});
