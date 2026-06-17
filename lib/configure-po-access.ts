import { CENTRAL_OPS_OR_ADMIN_ROLES } from "@/lib/admin-access";
import { assertRole, getRequestSession, type SessionUser } from "@/lib/session";

export { canAccessConfigurePO } from "@/lib/admin-access";

/** Ops guard for configure PO list and detail routes. */
export async function assertConfigurePOAccess(): Promise<SessionUser> {
  return assertRole(await getRequestSession(), [...CENTRAL_OPS_OR_ADMIN_ROLES]);
}
