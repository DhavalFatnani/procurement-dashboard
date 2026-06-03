// Import the Role enum from the standalone generated `enums` module rather than
// the `@/lib/prisma-client` barrel. The barrel re-exports the full Prisma client
// (`export * from ".../client"`), whose top-level `node:path`/`node:url`/`node:buffer`
// imports are illegal in the Edge Runtime — and `middleware.ts` pulls this file in.
// The `enums` module is dependency-free and safe to import anywhere.
import { Role } from "@/lib/generated/prisma/enums";

export type { Role };

export const ROLES = [Role.SM, Role.OPS_HEAD, Role.FINANCE] as const;

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    (Object.values(Role) as string[]).includes(value)
  );
}
