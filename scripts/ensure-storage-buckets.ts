/**
 * Creates Supabase Storage buckets required for invoice and payment uploads.
 * Run once per project: npm run storage:setup
 */
import { createClient } from "@supabase/supabase-js";

import { STORAGE_BUCKETS } from "../lib/storage";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env.local (see .env.example).`);
  }
  return value;
}

async function ensureBucket(
  supabase: ReturnType<typeof createClient>,
  id: string,
  label: string,
): Promise<void> {
  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`listBuckets failed: ${listError.message}`);
  }
  if (existing?.some((b) => b.id === id || b.name === id)) {
    console.log(`✓ ${label} bucket "${id}" already exists`);
    return;
  }

  const { error } = await supabase.storage.createBucket(id, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      console.log(`✓ ${label} bucket "${id}" already exists`);
      return;
    }
    throw new Error(`createBucket("${id}") failed: ${error.message}`);
  }

  console.log(`✓ Created ${label} bucket "${id}"`);
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureBucket(supabase, STORAGE_BUCKETS.invoices, "Invoice");
  await ensureBucket(supabase, STORAGE_BUCKETS.paymentProofs, "Payment proof");

  console.log("\nStorage buckets are ready for uploads.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
