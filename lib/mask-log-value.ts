/**
 * Masks sensitive change-log values before they are persisted or returned.
 * Account-number-like fields are reduced to a bullet-padded last-4; everything
 * else passes through unchanged. Null/empty values are preserved as-is.
 */
export function maskLogValue(
  fieldName: string,
  value: string | null | undefined,
): string | null {
  if (value == null || value === "") {
    return value ?? null;
  }
  if (fieldName === "accountNumber" || fieldName.toLowerCase().includes("account")) {
    const digits = value.replace(/\D/g, "");
    const last4 = digits.slice(-4) || value.slice(-4);
    return `••••${last4}`;
  }
  return value;
}
