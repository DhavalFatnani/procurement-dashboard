import type { PRStatus } from "@/lib/prisma-enums";
import type { VendorStatus } from "@/lib/prisma-enums";

export function buildPurchaseRequestParams(filters: {
  statuses: PRStatus[];
  categoryId: string;
  subcategoryId: string;
  executionType: string;
  warehouseId: string;
  createdById: string;
  dateFrom: string;
  dateTo: string;
  page?: number;
  exactCount?: boolean;
}): URLSearchParams {
  const params = new URLSearchParams();
  for (const s of filters.statuses) {
    params.append("status", s);
  }
  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }
  if (filters.subcategoryId) {
    params.set("subcategoryId", filters.subcategoryId);
  }
  if (filters.executionType) {
    params.set("executionType", filters.executionType);
  }
  if (filters.warehouseId) {
    params.set("warehouseId", filters.warehouseId);
  }
  if (filters.createdById) {
    params.set("createdById", filters.createdById);
  }
  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  if (filters.exactCount) {
    params.set("exactCount", "1");
  }
  return params;
}

export function purchaseRequestParamsFromForm(form: HTMLFormElement): URLSearchParams {
  const fd = new FormData(form);
  const statuses: PRStatus[] = [];
  const params = new URLSearchParams();

  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string" || value === "") {
      continue;
    }
    if (key === "status") {
      statuses.push(value as PRStatus);
    } else {
      params.set(key, value);
    }
  }
  for (const s of statuses) {
    params.append("status", s);
  }
  return params;
}

export function buildVendorListParams(filters: {
  search: string;
  statusFilter: VendorStatus | "ALL";
  tab?: string;
  page?: number;
  exactCount?: boolean;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.tab === "pending") {
    params.set("tab", "pending");
  } else {
    params.set("tab", "all");
  }
  if (filters.search) {
    params.set("q", filters.search);
  }
  if (filters.statusFilter !== "ALL") {
    params.set("status", filters.statusFilter);
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  if (filters.exactCount) {
    params.set("exactCount", "1");
  }
  return params;
}

export function vendorParamsFromForm(form: HTMLFormElement): URLSearchParams {
  const fd = new FormData(form);
  const params = new URLSearchParams();
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string" && value !== "") {
      params.set(key, value);
    }
  }
  if (!params.has("tab")) {
    params.set("tab", "all");
  }
  return params;
}
