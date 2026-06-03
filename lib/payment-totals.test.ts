import { PaymentStatus } from "@/lib/prisma-enums";
import { describe, expect, it } from "vitest";

import {
  computeRemaining,
  deriveInvoicePaymentStatus,
  sumPaymentAmounts,
} from "@/lib/payment-totals";

describe("payment totals", () => {
  it("sums payment amounts ignoring nulls", () => {
    expect(
      sumPaymentAmounts([
        { amount: 1000 },
        { amount: null },
        { amount: 500 },
      ]),
    ).toBe(1500);
  });

  it("derives invoice payment status from totals", () => {
    expect(deriveInvoicePaymentStatus(0, 5000)).toBe(PaymentStatus.UNPAID);
    expect(deriveInvoicePaymentStatus(2000, 5000)).toBe(PaymentStatus.PARTIALLY_PAID);
    expect(deriveInvoicePaymentStatus(5000, 5000)).toBe(PaymentStatus.PAID);
    expect(deriveInvoicePaymentStatus(6000, 5000)).toBe(PaymentStatus.PAID);
  });

  it("computes remaining balance", () => {
    expect(computeRemaining(5000, 2000)).toBe(3000);
    expect(computeRemaining(5000, 5000)).toBe(0);
    expect(computeRemaining(5000, 6000)).toBe(0);
  });
});
