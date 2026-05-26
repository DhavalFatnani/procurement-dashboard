import { z } from "zod";

/**
 * Field-normalization schemas for vendor writes. These centralize the
 * trim/case rules that were previously hand-rolled in each action and apply
 * them declaratively. They normalize only — the actions still own their
 * required-field and duplicate messaging so user-facing behavior is unchanged.
 */

const trimmed = z.string().transform((s) => s.trim());
const lowercased = z.string().transform((s) => s.trim().toLowerCase());
const uppercased = z.string().transform((s) => s.trim().toUpperCase());

/** GST normalizes to upper-case, or "" when blank/absent. */
const gstNormalized = z
  .string()
  .optional()
  .transform((s) => {
    const t = s?.trim();
    return t ? t.toUpperCase() : "";
  });

export const vendorCreateSchema = z.object({
  businessName: trimmed,
  pocName: trimmed,
  phone: trimmed,
  email: lowercased,
  address: trimmed,
  accountName: trimmed,
  accountNumber: trimmed,
  ifsc: uppercased,
  bankName: trimmed,
  gst: gstNormalized,
  similarVendorAckReason: z.string().optional(),
});

export const vendorUpdateSchema = z.object({
  pocName: trimmed,
  phone: trimmed,
  email: lowercased,
  address: trimmed,
  accountName: trimmed,
  accountNumber: trimmed,
  ifsc: uppercased,
  bankName: trimmed,
  reason: trimmed,
});

export type VendorCreateNormalized = z.infer<typeof vendorCreateSchema>;
export type VendorUpdateNormalized = z.infer<typeof vendorUpdateSchema>;
