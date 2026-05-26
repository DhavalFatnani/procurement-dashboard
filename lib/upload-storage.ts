import "server-only";

import { createSecretSupabaseClient } from "@/lib/supabase-admin";
import type { StorageBucketId } from "@/lib/storage";

export async function uploadStorageObject(
  bucket: StorageBucketId,
  objectPath: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const supabase = createSecretSupabaseClient();
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType,
    upsert: false,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, path: objectPath };
}

export async function createStorageSignedUrl(
  bucket: StorageBucketId,
  objectPath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const supabase = createSecretSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}
