/**
 * Single import surface for the Prisma 7 generated client.
 *
 * The v7 `prisma-client` generator splits its output: `PrismaClient` and the
 * `Prisma` namespace live in `client`, while enums (Role, PRStatus, …) live in
 * `enums`. Re-exporting both here lets the rest of the app keep a single import
 * specifier — `@/lib/prisma-client` — instead of remembering which submodule a
 * symbol comes from. The generated code itself is gitignored (see .gitignore)
 * and produced by `prisma generate`.
 */
export * from "@/lib/generated/prisma/client";
export * from "@/lib/generated/prisma/enums";
