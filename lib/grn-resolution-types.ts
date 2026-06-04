import {
  GRNExceptionDisposition,
  GRNExceptionOutcome,
  GRNExceptionResolution,
  GRNExceptionType,
} from "@/lib/prisma-enums";

import {
  allowedOutcomes,
  outcomeToLegacyCloseLine,
  outcomeToLegacyDisposition,
} from "@/lib/grn-exception-outcomes";

export type ResolveGrnExceptionInput = {
  outcome?: GRNExceptionOutcome;
  /** Legacy axes (mapped when outcome omitted). */
  disposition?: "KEEP" | "RETURN" | "NOT_RETURNED";
  commitment?: "EXPECT_REPLACEMENT" | "CLOSE_LINE";
  resolution?: GRNExceptionResolution;
  note?: string;
  disputedUnitPrice?: number;
  /** @deprecated Legacy */
  adjustedUnitPrice?: number;
  fulfilledQty?: number;
  effectiveUnitPrice?: number;
};

export type NormalizedResolveInput = {
  outcome: GRNExceptionOutcome;
  note?: string;
  disputedUnitPrice?: number;
};

export function dispositionToPrisma(
  disposition: "KEEP" | "RETURN" | "NOT_RETURNED",
): GRNExceptionDisposition {
  switch (disposition) {
    case "KEEP":
      return GRNExceptionDisposition.KEEP;
    case "RETURN":
      return GRNExceptionDisposition.RETURN_TO_VENDOR;
    case "NOT_RETURNED":
      return GRNExceptionDisposition.NOT_RETURNED;
  }
}

export function deriveResolutionStatus(outcome: GRNExceptionOutcome): GRNExceptionResolution {
  switch (outcome) {
    case GRNExceptionOutcome.ACCEPT_AT_PO_PRICE:
    case GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE:
      return GRNExceptionResolution.ACCEPTED;
    case GRNExceptionOutcome.RETURN_AND_SETTLE:
      return GRNExceptionResolution.OVERRIDE_ACCEPTED;
    case GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN:
      return GRNExceptionResolution.RETURNED_TO_VENDOR;
  }
}

function legacyToOutcome(
  disposition: "KEEP" | "RETURN" | "NOT_RETURNED",
  commitment: "EXPECT_REPLACEMENT" | "CLOSE_LINE",
  adjustedUnitPrice?: number,
): GRNExceptionOutcome {
  if (disposition === "KEEP" && commitment === "EXPECT_REPLACEMENT") {
    if (adjustedUnitPrice != null) {
      return GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE;
    }
    return GRNExceptionOutcome.ACCEPT_AT_PO_PRICE;
  }
  if (disposition === "KEEP" && commitment === "CLOSE_LINE") {
    return GRNExceptionOutcome.ACCEPT_AT_PO_PRICE;
  }
  if (commitment === "CLOSE_LINE") {
    return GRNExceptionOutcome.RETURN_AND_SETTLE;
  }
  return GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN;
}

export function normalizeResolveInput(
  input: ResolveGrnExceptionInput,
  exceptionType: GRNExceptionType,
): NormalizedResolveInput | { ok: false; message: string } {
  if (input.outcome) {
    if (!allowedOutcomes(exceptionType).includes(input.outcome)) {
      return { ok: false, message: "This resolution is not allowed for this exception type." };
    }
    return {
      outcome: input.outcome,
      note: input.note,
      disputedUnitPrice:
        input.disputedUnitPrice ?? input.adjustedUnitPrice ?? undefined,
    };
  }

  if (input.disposition && input.commitment) {
    const outcome = legacyToOutcome(
      input.disposition,
      input.commitment,
      input.adjustedUnitPrice ?? input.effectiveUnitPrice,
    );
    if (!allowedOutcomes(exceptionType).includes(outcome)) {
      return { ok: false, message: "This resolution is not allowed for this exception type." };
    }
    return {
      outcome,
      note: input.note,
      disputedUnitPrice:
        outcome === GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE
          ? (input.adjustedUnitPrice ?? input.effectiveUnitPrice)
          : undefined,
    };
  }

  if (input.resolution) {
    switch (input.resolution) {
      case GRNExceptionResolution.ACCEPTED:
        return normalizeResolveInput(
          {
            disposition: "KEEP",
            commitment: "EXPECT_REPLACEMENT",
            note: input.note,
            adjustedUnitPrice: input.adjustedUnitPrice,
          },
          exceptionType,
        );
      case GRNExceptionResolution.RETURNED_TO_VENDOR:
        return normalizeResolveInput(
          { disposition: "RETURN", commitment: "EXPECT_REPLACEMENT", note: input.note },
          exceptionType,
        );
      case GRNExceptionResolution.OVERRIDE_ACCEPTED:
        return normalizeResolveInput(
          {
            disposition: input.disposition ?? "NOT_RETURNED",
            commitment: "CLOSE_LINE",
            note: input.note,
          },
          exceptionType,
        );
    }
  }

  return { ok: false, message: "Choose a resolution outcome." };
}

export function describeResolutionChoice(outcome: GRNExceptionOutcome): string {
  const disposition = outcomeToLegacyDisposition(outcome);
  const closeLine = outcomeToLegacyCloseLine(outcome);
  const physical =
    disposition === "KEEP"
      ? "keep disputed qty as accepted"
      : "return disputed qty to vendor (off receipt)";
  const poLine = closeLine
    ? "update PO line committed qty to fulfilled amount"
    : outcome === GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN
      ? "PO line still expects replacement GRN"
      : "PO line unchanged";
  return `${physical}; ${poLine}.`;
}

/** @deprecated Use outcome-based types */
export type GrnDisputedDisposition = "KEEP" | "RETURN" | "NOT_RETURNED";
/** @deprecated Use outcome-based types */
export type GrnLineCommitment = "EXPECT_REPLACEMENT" | "CLOSE_LINE";
