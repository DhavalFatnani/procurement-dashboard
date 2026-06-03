// Prisma 7 requires a prisma.config.ts for CLI operations, and it no longer
// auto-loads .env files — so we load them explicitly here. `dotenv -e .env.local`
// (used by the db:* scripts) wins because those vars are already in process.env
// before this file runs; `import "dotenv/config"` then fills in anything from
// `.env` without overriding. The datasource (incl. directUrl for migrations)
// stays declared in prisma/schema.prisma.
import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // CLI/migrations connect directly (Accelerate URLs can't run migrations). The
  // app runtime instead uses `accelerateUrl` in lib/prisma.ts. DIRECT_URL is the
  // Supabase session pooler (port 5432).
  datasource: {
    url: env("DIRECT_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    // Replaces the removed package.json "prisma.seed" field.
    seed: "tsx prisma/seed.ts",
  },
});
