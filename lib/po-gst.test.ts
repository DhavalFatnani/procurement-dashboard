import { describe, expect, it } from "vitest";

import {
  applyGstToSubtotal,
  computeGstAmount,
  defaultGstApplicableForVendor,
  validatePoGstInput,
  vendorHasGstRegistration,
} from "@/lib/po-gst";

describe("po-gst", () => {
  it("detects vendor GST registration from GSTIN", () => {
    expect(vendorHasGstRegistration("22AAAAA0000A1Z5")).toBe(true);
    expect(vendorHasGstRegistration("  ")).toBe(false);
    expect(defaultGstApplicableForVendor("22AAAAA0000A1Z5")).toBe(true);
    expect(defaultGstApplicableForVendor(null)).toBe(false);
  });

  it("computes GST on subtotal", () => {
    expect(computeGstAmount(1000, 18)).toBe(180);
    expect(applyGstToSubtotal(1000, true, 18)).toEqual({
      subtotal: 1000,
      gstApplicable: true,
      gstRatePercent: 18,
      gstAmount: 180,
      total: 1180,
    });
    expect(applyGstToSubtotal(1000, false, 18).total).toBe(1000);
  });

  it("validates GST input", () => {
    expect(validatePoGstInput(false, null).ok).toBe(true);
    expect(validatePoGstInput(true, 18)).toEqual({ ok: true, rate: 18 });
    expect(validatePoGstInput(true, 0).ok).toBe(false);
  });
});
