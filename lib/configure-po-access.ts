import { redirect } from "next/navigation";

import { Role } from "@/lib/prisma-enums";
import { ACCESS } from "@/lib/route-access";
import { assertRole, getRequestSession, type SessionUser } from "@/lib/session";

/** Ops-only guard for configure PO list and detail routes. */
export async function assertConfigurePOAccess(): Promise<SessionUser> {
  const user = assertRole(await getRequestSession(), [...ACCESS.purchaseOrders]);
  if (user.role !== Role.OPS_HEAD && user.role !== Role.ADMIN) {
    redirect("/purchase-orders");
  }
  return user;
}
