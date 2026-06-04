import {
  GRNExceptionOutcome,
  GRNExceptionType,
} from "@/lib/prisma-enums";

/** Exception types SM can flag when recording a GRN. */
export const SM_GRN_EXCEPTION_TYPES = [
  GRNExceptionType.DAMAGED,
  GRNExceptionType.WRONG_ITEM,
  GRNExceptionType.QUALITY_REJECTION,
] as const satisfies readonly GRNExceptionType[];

export const SM_GRN_EXCEPTION_TYPE_LABELS: Record<
  (typeof SM_GRN_EXCEPTION_TYPES)[number],
  string
> = {
  [GRNExceptionType.DAMAGED]: "Damaged",
  [GRNExceptionType.WRONG_ITEM]: "Wrong item received",
  [GRNExceptionType.QUALITY_REJECTION]: "Quality rejection",
};

export function smCreatableExceptionTypes(): GRNExceptionType[] {
  return [...SM_GRN_EXCEPTION_TYPES];
}

export function isSmCreatableExceptionType(type: GRNExceptionType): boolean {
  return (SM_GRN_EXCEPTION_TYPES as readonly GRNExceptionType[]).includes(type);
}

export function allowsRepricedAccept(exceptionType: GRNExceptionType): boolean {
  return (
    exceptionType === GRNExceptionType.DAMAGED ||
    exceptionType === GRNExceptionType.QUALITY_REJECTION
  );
}

export function allowedOutcomes(exceptionType: GRNExceptionType): GRNExceptionOutcome[] {
  const all: GRNExceptionOutcome[] = [
    GRNExceptionOutcome.ACCEPT_AT_PO_PRICE,
    GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE,
    GRNExceptionOutcome.RETURN_AND_SETTLE,
    GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN,
  ];
  if (allowsRepricedAccept(exceptionType)) {
    return all;
  }
  return all.filter((o) => o !== GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE);
}

export function defaultOutcome(exceptionType: GRNExceptionType): GRNExceptionOutcome {
  if (
    exceptionType === GRNExceptionType.WRONG_ITEM ||
    exceptionType === GRNExceptionType.QUANTITY_SHORT
  ) {
    return GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN;
  }
  return GRNExceptionOutcome.ACCEPT_AT_PO_PRICE;
}

export function requiresDisputedCatalogVariant(
  outcome: GRNExceptionOutcome,
  exceptionType: GRNExceptionType,
): boolean {
  return (
    outcome === GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE &&
    allowsRepricedAccept(exceptionType)
  );
}

export function resolutionNoteRequired(outcome: GRNExceptionOutcome): boolean {
  return (
    outcome === GRNExceptionOutcome.RETURN_AND_SETTLE ||
    outcome === GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN ||
    outcome === GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE
  );
}

export function resolutionNoteHint(
  exceptionType: GRNExceptionType,
  outcome: GRNExceptionOutcome,
): string {
  if (outcome === GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE) {
    if (exceptionType === GRNExceptionType.DAMAGED) {
      return "Vendor agreed reduced unit price for damaged qty retained on site.";
    }
    return "Quality rejection settled at agreed unit price.";
  }
  if (outcome === GRNExceptionOutcome.RETURN_AND_SETTLE) {
    if (exceptionType === GRNExceptionType.QUANTITY_SHORT) {
      return "Short qty not invoiced; PO settled at accepted quantity.";
    }
    return "Returned qty not kept; PO commitment reduced to accepted quantity.";
  }
  if (outcome === GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN) {
    if (exceptionType === GRNExceptionType.WRONG_ITEM) {
      return "Wrong SKU returned; correct item to be re-received.";
    }
    return "Replacement GRN required before invoicing.";
  }
  return "Optional notes for audit.";
}

export const OUTCOME_LABELS: Record<GRNExceptionOutcome, string> = {
  [GRNExceptionOutcome.ACCEPT_AT_PO_PRICE]: "Accept at PO price",
  [GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE]: "Accept at new price",
  [GRNExceptionOutcome.RETURN_AND_SETTLE]: "Return and settle PO",
  [GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN]: "Replace (await GRN)",
};

export const OUTCOME_DESCRIPTIONS: Record<GRNExceptionOutcome, string> = {
  [GRNExceptionOutcome.ACCEPT_AT_PO_PRICE]:
    "Keep disputed quantity at the original PO unit price.",
  [GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE]:
    "Keep disputed quantity at a negotiated unit price (disputed catalog line).",
  [GRNExceptionOutcome.RETURN_AND_SETTLE]:
    "Send disputed quantity back; reduce PO commitment to accepted qty only.",
  [GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN]:
    "Send disputed quantity back; record a replacement GRN before invoicing.",
};

/** Map outcome to legacy fields for reports during transition. */
export function outcomeToLegacyDisposition(
  outcome: GRNExceptionOutcome,
): "KEEP" | "RETURN" | "NOT_RETURNED" {
  switch (outcome) {
    case GRNExceptionOutcome.ACCEPT_AT_PO_PRICE:
    case GRNExceptionOutcome.ACCEPT_AT_DISPUTED_PRICE:
      return "KEEP";
    case GRNExceptionOutcome.RETURN_AND_SETTLE:
      return "RETURN";
    case GRNExceptionOutcome.REPLACE_AND_AWAIT_GRN:
      return "RETURN";
  }
}

export function outcomeToLegacyCloseLine(outcome: GRNExceptionOutcome): boolean {
  return outcome === GRNExceptionOutcome.RETURN_AND_SETTLE;
}
