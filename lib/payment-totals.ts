import { PaymentStatus } from "@prisma/client";

export type PaymentAmountRow = { amount: unknown };

export function sumPaymentAmounts(payments: PaymentAmountRow[]): number {
  return payments.reduce((sum, payment) => {
    if (payment.amount == null) {
      return sum;
    }
    const n = Number(payment.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export function deriveInvoicePaymentStatus(
  totalPaid: number,
  invoiceAmount: number,
): PaymentStatus {
  if (totalPaid <= 0) {
    return PaymentStatus.UNPAID;
  }
  if (totalPaid >= invoiceAmount) {
    return PaymentStatus.PAID;
  }
  return PaymentStatus.PARTIALLY_PAID;
}

export function computeRemaining(invoiceAmount: number, totalPaid: number): number {
  return Math.max(0, invoiceAmount - totalPaid);
}
