/** Canonical Finance payables routes — use for nav, redirects, and deep links. */
export const FINANCE_ROUTES = {
  invoiceSettlement: "/payments/invoices",
  vendorAdvances: "/vendor-advances",
  paymentRegister: "/payments/register",
  invoiceDetail: (invoiceId: string) =>
    `/payments/invoices/${encodeURIComponent(invoiceId)}`,
  cashPaymentDetail: (paymentId: string) =>
    `/payments/cash/${encodeURIComponent(paymentId)}`,
  allocationDetail: (allocationId: string) =>
    `/payments/allocations/${encodeURIComponent(allocationId)}`,
  advanceRequestDetail: (requestId: string) =>
    `/vendor-advances/requests/${encodeURIComponent(requestId)}`,
  advancePaymentDetail: (advancePaymentId: string) =>
    `/vendor-advances/payments/${encodeURIComponent(advancePaymentId)}`,
} as const;

/** Legacy `/payments` query params → new routes. */
export function redirectPaymentsLegacyPath(
  sp: Record<string, string | string[] | undefined>,
): string | null {
  const str = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : "";

  const invoiceId = str(sp.invoiceId);
  if (invoiceId) {
    return FINANCE_ROUTES.invoiceDetail(invoiceId);
  }

  const advanceRequestId = str(sp.advanceRequestId);
  if (str(sp.view) === "advance") {
    if (advanceRequestId) {
      return `${FINANCE_ROUTES.vendorAdvances}?advanceRequestId=${encodeURIComponent(advanceRequestId)}`;
    }
    return FINANCE_ROUTES.vendorAdvances;
  }

  const qs = new URLSearchParams();
  for (const key of [
    "paymentStatus",
    "matchStatus",
    "vendorId",
    "poId",
    "dateFrom",
    "dateTo",
    "page",
    "exactCount",
  ] as const) {
    const v = str(sp[key]);
    if (v) qs.set(key, v);
  }
  const suffix = qs.toString();
  return suffix
    ? `${FINANCE_ROUTES.invoiceSettlement}?${suffix}`
    : FINANCE_ROUTES.invoiceSettlement;
}
