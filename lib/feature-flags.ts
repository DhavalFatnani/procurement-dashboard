/**
 * Lightweight feature-flag helper for staged roll-outs.
 *
 * The redesign ships behind `redesign-2026` so we can rehearse IA changes
 * (role-aware landing, sidebar grouping, command palette) on staging before
 * flipping production.
 *
 * Reads `NEXT_PUBLIC_FLAG_<NAME>` for client-visible flags so they're embedded
 * at build time; server-only flags can read `process.env.FLAG_<NAME>`.
 *
 * Defaults `redesign-2026` to ON since the rest of the codebase already
 * depends on the new components after this change. Set
 * `NEXT_PUBLIC_FLAG_REDESIGN_2026=0` in an env file to opt out.
 */

const FLAG_DEFAULTS: Record<string, boolean> = {
  "redesign-2026": true,
};

function envFor(flag: string): string | undefined {
  const upper = flag.replaceAll("-", "_").toUpperCase();
  const publicKey = `NEXT_PUBLIC_FLAG_${upper}`;
  const privateKey = `FLAG_${upper}`;
  const env = process.env as Record<string, string | undefined>;
  return env[publicKey] ?? env[privateKey];
}

export function flagEnabled(flag: keyof typeof FLAG_DEFAULTS | string): boolean {
  const value = envFor(flag);
  if (value == null) {
    return FLAG_DEFAULTS[flag] ?? false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

export const FLAGS = {
  REDESIGN_2026: "redesign-2026" as const,
};
