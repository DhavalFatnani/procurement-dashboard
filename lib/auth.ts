import { redirect } from "next/navigation";

import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase";
import type { Role } from "@/types";
import { isRole } from "@/types";

export type SessionUser = User & { role: Role };

function roleFromUser(user: User): Role | null {
  const raw =
    (user.user_metadata as Record<string, unknown> | undefined)?.role ??
    (user.app_metadata as Record<string, unknown> | undefined)?.role;
  return isRole(raw) ? raw : null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  const role = roleFromUser(user);
  if (!role) {
    return null;
  }
  return { ...user, role };
}

export async function checkRole(allowedRoles: readonly Role[]): Promise<SessionUser> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    redirect("/login");
  }
  const role = roleFromUser(user);
  if (!role) {
    redirect("/unauthorized");
  }
  if (!allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }
  return { ...user, role };
}
