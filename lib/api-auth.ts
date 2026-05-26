import { NextResponse } from "next/server";

import { getRequestSession, type SessionUser } from "@/lib/session";
import type { Role } from "@/types";

export async function requireApiSession(
  allowedRoles: readonly Role[],
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getRequestSession();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}
