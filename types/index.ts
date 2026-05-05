import { Role } from "@prisma/client";

export type { Role };

export const ROLES = [Role.SM, Role.OPS_HEAD, Role.FINANCE] as const;

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    (Object.values(Role) as string[]).includes(value)
  );
}
