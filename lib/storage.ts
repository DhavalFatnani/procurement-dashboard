/** Supabase Storage bucket IDs (see `supabase/migrations`). */
export const STORAGE_BUCKETS = {
  invoices: "invoices",
  paymentProofs: "payment-proofs",
} as const;

export type StorageBucketId = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
