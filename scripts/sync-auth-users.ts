/**
 * Import Supabase Auth users into the Prisma User table.
 *
 * Usage: pnpm db:sync-auth-users
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type User } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

import { PrismaClient } from "@/lib/prisma-client";
import { syncAuthUsersToDatabase } from "@/lib/sync-auth-users";

dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

async function listAllAuthUsers(): Promise<User[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local",
    );
  }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const users: User[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw error;
    }
    users.push(...data.users);
    if (data.users.length < 200) {
      break;
    }
  }
  return users;
}

async function main() {
  const authUsers = await listAllAuthUsers();
  const result = await syncAuthUsersToDatabase(prisma, authUsers);

  for (const row of result.synced) {
    console.log(
      `[sync-auth-users] ${row.created ? "Created" : "Updated"} ${row.email} (${row.id})`,
    );
  }

  for (const row of result.skipped) {
    console.warn(
      `[sync-auth-users] Skipped ${row.email ?? row.id}: ${row.reason}`,
    );
  }

  console.log(
    `\n[sync-auth-users] Done — ${result.synced.length} synced, ${result.skipped.length} skipped.`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
