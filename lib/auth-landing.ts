import { defaultLandingFor } from "@/lib/navigation";
import { isRole } from "@/types";

type AuthUserLike = {
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
} | null;

/** Where to send a user after they set or reset their password while signed in. */
export function landingPathForAuthUser(user: AuthUserLike): string {
  if (!user) {
    return "/login";
  }
  const appMeta = user.app_metadata ?? {};
  const rawRole = user.user_metadata?.role ?? appMeta.role;
  const role = isRole(rawRole) ? rawRole : null;
  return role ? defaultLandingFor(role) : "/dashboard";
}
