/**
 * Client-safe enum surface for the Prisma 7 generated client.
 *
 * The generated `enums` module is self-contained (plain `as const` objects, no
 * imports), so it can be bundled into Client Components, middleware (edge), and
 * server code alike. Import enums (Role, PRStatus, …) from HERE, never from
 * `@/lib/prisma-client` — that barrel pulls the full server client (node:os /
 * node:path / import.meta) and will break client/edge bundles.
 */
export * from "@/lib/generated/prisma/enums";
