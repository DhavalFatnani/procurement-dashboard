import {
  GRNExceptionOutcome,
  GRNExceptionResolution,
  GRNExceptionType,
} from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import { allowedOutcomes, defaultOutcome } from "@/lib/grn-exception-outcomes";
import {
  deriveResolutionStatus,
  normalizeResolveInput,
} from "@/lib/grn-resolution-types";
import { validateResolveGrnExceptionInput } from "@/lib/grn-resolution";

describe("normalizeResolveInput", () => {
  it("accepts explicit outcome", () => {
    const n = normalizeResolveInput(
      { outcome: GRNExceptionOutcome.RETURN_AND_SETTLE, note: "Returned" },
      GRNExceptionType.DAMAGED,
    );
    expect("ok" in n).toBe(false);
    if ("ok" in n) return;
    expect(n.outcome).toBe(GRNExceptionOutcome.RETURN_AND_SETTLE);
  });

  it("rejects repriced accept for wrong item", () => {
    const n = normalizeResolveInput(
      { outcome: GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE, disputedUnitPrice: 10 },
      GRNExceptionType.WRONG_ITEM,
    );
    expect("ok" in n).toBe(true);
    if (!("ok" in n)) return;
    expect(n.ok).toBe(false);
  });

  it("maps legacy override to return and settle for damaged", () => {
    const n = normalizeResolveInput(
      {
        disposition: "NOT_RETURNED",
        commitment: "CLOSE_LINE",
        note: "Short",
      },
      GRNExceptionType.DAMAGED,
    );
    expect("ok" in n).toBe(false);
    if ("ok" in n) return;
    expect(n.outcome).toBe(GRNExceptionOutcome.RETURN_AND_SETTLE);
  });
});

describe("deriveResolutionStatus", () => {
  it("maps four outcomes to legacy resolution status", () => {
    expect(deriveResolutionStatus(GRNExceptionOutcome.ACCEPT_AT_PO_PRICE)).toBe(
      GRNExceptionResolution.ACCEPTED,
    );
    expect(deriveResolutionStatus(GRNExceptionOutcome.RETURN_AND_SETTLE)).toBe(
      GRNExceptionResolution.OVERRIDE_ACCEPTED,
    );
    expect(deriveResolutionStatus(GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN)).toBe(
      GRNExceptionResolution.RETURNED_TO_VENDOR,
    );
  });
});

describe("validateResolveGrnExceptionInput", () => {
  it("requires note for return and settle", () => {
    expect(
      validateResolveGrnExceptionInput(GRNExceptionType.DAMAGED, {
        outcome: GRNExceptionOutcome.RETURN_AND_SETTLE,
      }).ok,
    ).toBe(false);
    expect(
      validateResolveGrnExceptionInput(GRNExceptionType.DAMAGED, {
        outcome: GRNExceptionOutcome.RETURN_AND_SETTLE,
        note: "Vendor took goods back",
      }).ok,
    ).toBe(true);
  });

  it("requires disputed unit price for repriced accept", () => {
    expect(
      validateResolveGrnExceptionInput(GRNExceptionType.DAMAGED, {
        outcome: GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE,
        note: "Agreed",
      }).ok,
    ).toBe(false);
    expect(
      validateResolveGrnExceptionInput(GRNExceptionType.DAMAGED, {
        outcome: GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE,
        note: "Agreed",
        disputedUnitPrice: 12.5,
      }).ok,
    ).toBe(true);
  });
});

describe("grn-exception-outcomes", () => {
  it("hides repriced accept for quantity short and wrong item", () => {
    expect(allowedOutcomes(GRNExceptionType.QUANTITY_SHORT)).not.toContain(
      GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE,
    );
    expect(allowedOutcomes(GRNExceptionType.WRONG_ITEM)).not.toContain(
      GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE,
    );
  });

  it("defaults wrong item to replace", () => {
    expect(defaultOutcome(GRNExceptionType.WRONG_ITEM)).toBe(
      GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN,
    );
  });
});
