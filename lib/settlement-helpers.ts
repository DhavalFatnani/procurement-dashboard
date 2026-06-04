export type SettlementComposition =
  | "unpaid"
  | "advance_only"
  | "cash_only"
  | "advance_and_cash";

export function maxAdvanceApplicable(
  advanceUnallocated: number,
  remaining: number,
): number {
  if (advanceUnallocated <= 0 || remaining <= 0) {
    return 0;
  }
  return Math.min(advanceUnallocated, remaining);
}

export function deriveCashDue(remaining: number, advanceAllocation: number): number {
  return Math.max(0, remaining - advanceAllocation);
}

export function deriveSettlementComposition(
  advanceAllocated: number,
  cashPaid: number,
): SettlementComposition {
  const hasAdvance = advanceAllocated > 0.001;
  const hasCash = cashPaid > 0.001;
  if (!hasAdvance && !hasCash) {
    return "unpaid";
  }
  if (hasAdvance && hasCash) {
    return "advance_and_cash";
  }
  if (hasAdvance) {
    return "advance_only";
  }
  return "cash_only";
}

export function settlementCompositionLabel(composition: SettlementComposition): string {
  switch (composition) {
    case "advance_only":
      return "Advance only";
    case "cash_only":
      return "Cash only";
    case "advance_and_cash":
      return "Advance + cash";
    default:
      return "Unpaid";
  }
}

export function confirmSettlementLabel(
  advanceAllocation: number,
  cashDue: number,
): string {
  const parts: string[] = [];
  if (advanceAllocation > 0.001) {
    parts.push(`₹${advanceAllocation.toLocaleString("en-IN")} advance`);
  }
  if (cashDue > 0.001) {
    parts.push(`₹${cashDue.toLocaleString("en-IN")} cash`);
  }
  if (parts.length === 0) {
    return "Confirm settlement";
  }
  return `Confirm settlement (${parts.join(" + ")})`;
}
