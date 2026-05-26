import type { VerifiedIdentity } from "@/lib/auth-claims";

/** Internal request headers set by middleware after JWT verification. */
export const KNOT_USER_ID = "x-knot-user-id";
export const KNOT_USER_EMAIL = "x-knot-user-email";
export const KNOT_USER_META = "x-knot-user-meta";
export const KNOT_APP_META = "x-knot-app-meta";

function parseJsonRecord(raw: string | null): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function identityFromHeaders(
  headers: Headers,
): VerifiedIdentity | null {
  const id = headers.get(KNOT_USER_ID);
  if (!id) {
    return null;
  }
  return {
    id,
    email: headers.get(KNOT_USER_EMAIL) || null,
    userMetadata: parseJsonRecord(headers.get(KNOT_USER_META)),
    appMetadata: parseJsonRecord(headers.get(KNOT_APP_META)),
  };
}

export function applyIdentityHeaders(
  requestHeaders: Headers,
  identity: VerifiedIdentity,
): void {
  requestHeaders.set(KNOT_USER_ID, identity.id);
  requestHeaders.set(KNOT_USER_EMAIL, identity.email ?? "");
  requestHeaders.set(KNOT_USER_META, JSON.stringify(identity.userMetadata));
  requestHeaders.set(KNOT_APP_META, JSON.stringify(identity.appMetadata));
}

export function warehouseIdFromMetadata(
  appMetadata: Record<string, unknown>,
): string | null {
  const raw = appMetadata.warehouseId;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}
