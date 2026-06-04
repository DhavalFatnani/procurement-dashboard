/** Common GST rates (%) for Indian procurement POs. */
export const STANDARD_GST_RATES = [0, 5, 12, 18, 28] as const;

export type PoGstBilling = {
  subtotal: number;
  gstApplicable: boolean;
  gstRatePercent: number | null;
  gstAmount: number;
  total: number;
};

export function vendorHasGstRegistration(gst: string | null | undefined): boolean {
  return Boolean(gst?.trim());
}

export function defaultGstApplicableForVendor(gst: string | null | undefined): boolean {
  return vendorHasGstRegistration(gst);
}

export function defaultGstRatePercentForVendor(gst: string | null | undefined): number {
  return vendorHasGstRegistration(gst) ? 18 : 0;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function computeGstAmount(subtotal: number, ratePercent: number): number {
  if (subtotal <= 0 || ratePercent <= 0) {
    return 0;
  }
  return roundMoney((subtotal * ratePercent) / 100);
}

export function applyGstToSubtotal(
  subtotal: number,
  gstApplicable: boolean,
  gstRatePercent: number | null | undefined,
): PoGstBilling {
  const rate =
    gstApplicable && gstRatePercent != null && Number.isFinite(gstRatePercent)
      ? gstRatePercent
      : null;
  const gstAmount = gstApplicable && rate != null && rate > 0 ? computeGstAmount(subtotal, rate) : 0;
  return {
    subtotal: roundMoney(subtotal),
    gstApplicable,
    gstRatePercent: gstApplicable ? rate : null,
    gstAmount,
    total: roundMoney(subtotal + gstAmount),
  };
}

export function computeSubtotalFromLines(
  lines: { orderedQty: number; unitPrice: string | number }[],
): number {
  return roundMoney(
    lines.reduce((sum, line) => sum + line.orderedQty * Number(line.unitPrice), 0),
  );
}

export function computePoOrderBilling(
  lines: { orderedQty: number; unitPrice: string | number }[],
  gstApplicable: boolean,
  gstRatePercent: string | null | undefined,
): PoGstBilling {
  return applyGstToSubtotal(
    computeSubtotalFromLines(lines),
    gstApplicable,
    gstRatePercent != null && gstRatePercent !== ""
      ? Number(gstRatePercent)
      : null,
  );
}

export function validatePoGstInput(
  gstApplicable: boolean,
  gstRatePercent: number | null | undefined,
): { ok: true; rate: number | null } | { ok: false; message: string } {
  if (!gstApplicable) {
    return { ok: true, rate: null };
  }
  const rate = Number(gstRatePercent);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, message: "Enter a GST rate greater than zero when GST applies." };
  }
  if (rate > 100) {
    return { ok: false, message: "GST rate cannot exceed 100%." };
  }
  return { ok: true, rate: roundMoney(rate) };
}
