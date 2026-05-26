import "server-only";

import { Role } from "@prisma/client";

import { getRequestSession } from "@/lib/session";

export class ActionAuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "ActionAuthError";
  }
}

/** Use at the top of server actions; throws if session or role is invalid. */
export async function requireRoles(allowed: readonly Role[]) {
  const user = await getRequestSession();
  if (!user) {
    throw new ActionAuthError("Not signed in");
  }
  if (!allowed.includes(user.role)) {
    throw new ActionAuthError("You do not have access to this action");
  }
  return user;
}
