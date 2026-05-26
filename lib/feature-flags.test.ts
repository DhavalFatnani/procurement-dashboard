import { afterEach, describe, expect, it } from "vitest";

import { FLAGS, flagEnabled } from "@/lib/feature-flags";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("flagEnabled", () => {
  it("returns the default ON for redesign-2026 when no env is set", () => {
    delete process.env.FLAG_REDESIGN_2026;
    delete process.env.NEXT_PUBLIC_FLAG_REDESIGN_2026;
    expect(flagEnabled(FLAGS.REDESIGN_2026)).toBe(true);
  });

  it("honours an explicit 0 to disable a flag", () => {
    process.env.NEXT_PUBLIC_FLAG_REDESIGN_2026 = "0";
    expect(flagEnabled(FLAGS.REDESIGN_2026)).toBe(false);
  });

  it("honours an explicit 1 / true to enable an unknown flag", () => {
    process.env.NEXT_PUBLIC_FLAG_EXPERIMENTAL = "1";
    expect(flagEnabled("experimental")).toBe(true);
    process.env.NEXT_PUBLIC_FLAG_EXPERIMENTAL = "true";
    expect(flagEnabled("experimental")).toBe(true);
  });

  it("returns false for unknown flags without env values", () => {
    delete process.env.FLAG_NONEXISTENT;
    delete process.env.NEXT_PUBLIC_FLAG_NONEXISTENT;
    expect(flagEnabled("nonexistent")).toBe(false);
  });
});
