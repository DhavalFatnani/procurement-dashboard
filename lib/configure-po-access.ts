import { redirect } from "next/navigation";

import { canAccessConfigurePO } from "@/lib/admin-access";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession, type SessionUser } from "@/lib/session";

export { canAccessConfigurePO } from "@/lib/admin-access";

/** Ops guard for configure PO list and detail routes. */
export async function assertConfigurePOAccess(): Promise<SessionUser> {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseOrders]);
  if (!canAccessConfigurePO(user.role)) {
    redirect("/purchase-orders");
  }
  return user;
}
