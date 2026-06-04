import type { PRLineInput } from "@/lib/pr-line-persistence";

export type PRFormData = {
  lines: PRLineInput[];
  vendorId?: string | null;
  vendorRequestId?: string | null;
  warehouseId?: string;
};

export type CreatePOItemPriceInput = {
  prLineItemId: string;
  unitPrice: number;
};

/** @deprecated Use itemPrices */
export type CreatePOLinePriceInput = CreatePOItemPriceInput;

export type CreatePOAdvanceRequestInput = {
  amount?: number;
  percent?: number;
  reason: string;
};

export type CreatePOFromPRInput = {
  vendorId: string;
  itemPrices: CreatePOItemPriceInput[];
  expectedDelivery: string;
  gstApplicable: boolean;
  gstRatePercent?: number | null;
  advanceRequest?: CreatePOAdvanceRequestInput | null;
};

export type CreatePOFromPRGroupInput = CreatePOFromPRInput;

export type ApprovePRInput = {
  approvedCatalogItemIds: string[];
  rejected: { id: string; reason: string }[];
};
