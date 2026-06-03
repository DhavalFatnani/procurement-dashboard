import {
  ExecutionType,
  InvoiceMatchStatus,
  PaymentStatus,
  POStatus,
  PRStatus,
  SerialSeries,
  VendorStatus,
} from "@/lib/prisma-enums";
import type { ReservationEventType } from "@/lib/serial-series";

export function parsePurchaseRequestSearchParams(
  params: URLSearchParams,
): {
  statuses: PRStatus[];
  categoryId: string;
  subcategoryId: string;
  executionType: string;
  executionTypeParsed?: ExecutionType;
  warehouseId: string;
  createdById: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  includeExactCount: boolean;
} {
  const statuses = params
    .getAll("status")
    .filter((v): v is PRStatus => (Object.values(PRStatus) as string[]).includes(v));

  const categoryId = params.get("categoryId") ?? "";
  const subcategoryId = params.get("subcategoryId") ?? "";
  const executionTypeRaw = params.get("executionType") ?? "";
  const executionTypeParsed =
    executionTypeRaw === ExecutionType.VENDOR_PURCHASE ||
    executionTypeRaw === ExecutionType.INTERNAL_PRINT
      ? executionTypeRaw
      : undefined;

  return {
    statuses,
    categoryId,
    subcategoryId,
    executionType: executionTypeRaw,
    executionTypeParsed,
    warehouseId: params.get("warehouseId") ?? "",
    createdById: params.get("createdById") ?? "",
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
    includeExactCount: params.get("exactCount") === "1",
  };
}

/**
 * Page-prop variant of {@link parsePurchaseRequestSearchParams}. Next.js page
 * `searchParams` arrive as a record of string | string[] | undefined. This
 * preserves the page's existing semantics exactly: non-status array values are
 * treated as empty (only the multi-valued `status` param accepts arrays).
 */
export function parsePurchaseRequestPageParams(
  sp: Record<string, string | string[] | undefined>,
): ReturnType<typeof parsePurchaseRequestSearchParams> {
  const str = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : "";

  const statuses = (Array.isArray(sp.status) ? sp.status : sp.status ? [sp.status] : [])
    .filter((v): v is PRStatus => (Object.values(PRStatus) as string[]).includes(v));

  const executionTypeRaw = str(sp.executionType);
  const executionTypeParsed =
    executionTypeRaw === ExecutionType.VENDOR_PURCHASE ||
    executionTypeRaw === ExecutionType.INTERNAL_PRINT
      ? executionTypeRaw
      : undefined;

  return {
    statuses,
    categoryId: str(sp.categoryId),
    subcategoryId: str(sp.subcategoryId),
    executionType: executionTypeRaw,
    executionTypeParsed,
    warehouseId: str(sp.warehouseId),
    createdById: str(sp.createdById),
    dateFrom: str(sp.dateFrom),
    dateTo: str(sp.dateTo),
    page: Math.max(1, Number(str(sp.page) || "1") || 1),
    includeExactCount: sp.exactCount === "1",
  };
}

export function parseVendorSearchParams(params: URLSearchParams): {
  search: string;
  statusFilter: VendorStatus | "ALL";
  page: number;
  includeExactCount: boolean;
} {
  const statusRaw = params.get("status") ?? "ALL";
  const statusFilter =
    statusRaw === "ACTIVE" || statusRaw === "INACTIVE" ? statusRaw : "ALL";

  return {
    search: params.get("q") ?? "",
    statusFilter,
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
    includeExactCount: params.get("exactCount") === "1",
  };
}

export function parsePurchaseOrderPageParams(
  sp: Record<string, string | string[] | undefined>,
): {
  status: POStatus | "";
  vendorId: string;
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
  fulfill: string;
  page: number;
  includeExactCount: boolean;
} {
  const str = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : "";

  const statusRaw = str(sp.status);
  const status = (Object.values(POStatus) as string[]).includes(statusRaw)
    ? (statusRaw as POStatus)
    : "";

  return {
    status,
    vendorId: str(sp.vendorId),
    warehouseId: str(sp.warehouseId),
    dateFrom: str(sp.dateFrom),
    dateTo: str(sp.dateTo),
    fulfill: str(sp.fulfill),
    page: Math.max(1, Number(str(sp.page) || "1") || 1),
    includeExactCount: sp.exactCount === "1",
  };
}

export function parseGRNPageParams(
  sp: Record<string, string | string[] | undefined>,
): {
  poId: string;
  vendorId: string;
  dateFrom: string;
  dateTo: string;
  hasExceptions: "" | "yes" | "no";
  page: number;
  includeExactCount: boolean;
} {
  const str = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : "";

  const exRaw = str(sp.hasExceptions);
  const hasExceptions =
    exRaw === "yes" || exRaw === "no" ? exRaw : ("" as const);

  return {
    poId: str(sp.poId),
    vendorId: str(sp.vendorId),
    dateFrom: str(sp.dateFrom),
    dateTo: str(sp.dateTo),
    hasExceptions,
    page: Math.max(1, Number(str(sp.page) || "1") || 1),
    includeExactCount: sp.exactCount === "1",
  };
}

export function parseInvoicePageParams(
  sp: Record<string, string | string[] | undefined>,
): {
  matchStatus: InvoiceMatchStatus | "";
  paymentStatus: PaymentStatus | "";
  vendorId: string;
  poId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  includeExactCount: boolean;
} {
  const str = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : "";

  const matchRaw = str(sp.matchStatus);
  const matchStatus = (Object.values(InvoiceMatchStatus) as string[]).includes(matchRaw)
    ? (matchRaw as InvoiceMatchStatus)
    : "";

  const payRaw = str(sp.paymentStatus);
  const paymentStatus = (Object.values(PaymentStatus) as string[]).includes(payRaw)
    ? (payRaw as PaymentStatus)
    : "";

  return {
    matchStatus,
    paymentStatus,
    vendorId: str(sp.vendorId),
    poId: str(sp.poId),
    dateFrom: str(sp.dateFrom),
    dateTo: str(sp.dateTo),
    page: Math.max(1, Number(str(sp.page) || "1") || 1),
    includeExactCount: sp.exactCount === "1",
  };
}

export function parsePaymentPageParams(
  sp: Record<string, string | string[] | undefined>,
): {
  paymentStatus: PaymentStatus | "";
  matchStatus: InvoiceMatchStatus | "";
  vendorId: string;
  poId: string;
  invoiceId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  includeExactCount: boolean;
} {
  const str = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : "";

  const payRaw = str(sp.paymentStatus);
  const paymentStatus = (Object.values(PaymentStatus) as string[]).includes(payRaw)
    ? (payRaw as PaymentStatus)
    : "";

  const matchRaw = str(sp.matchStatus);
  const matchStatus = (Object.values(InvoiceMatchStatus) as string[]).includes(matchRaw)
    ? (matchRaw as InvoiceMatchStatus)
    : "";

  return {
    paymentStatus,
    matchStatus,
    vendorId: str(sp.vendorId),
    poId: str(sp.poId),
    invoiceId: str(sp.invoiceId),
    dateFrom: str(sp.dateFrom),
    dateTo: str(sp.dateTo),
    page: Math.max(1, Number(str(sp.page) || "1") || 1),
    includeExactCount: sp.exactCount === "1",
  };
}

export function parseSerialGovernancePageParams(
  sp: Record<string, string | string[] | undefined>,
): {
  tab: string;
  series: SerialSeries | "";
  type: ReservationEventType | "";
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  batch: string;
  includeExactCount: boolean;
} {
  const str = (v: string | string[] | undefined): string =>
    typeof v === "string" ? v : "";

  const tab = str(sp.tab) || "summary";
  const seriesRaw = str(sp.series);
  const series = (Object.values(SerialSeries) as string[]).includes(seriesRaw)
    ? (seriesRaw as SerialSeries)
    : "";

  const typeRaw = str(sp.type);
  const type =
    typeRaw === "Receipt" || typeRaw === "Print" ? typeRaw : ("" as const);

  return {
    tab,
    series,
    type,
    warehouseId: str(sp.warehouseId),
    dateFrom: str(sp.dateFrom),
    dateTo: str(sp.dateTo),
    page: Math.max(1, Number(str(sp.page) || "1") || 1),
    batch: str(sp.batch),
    includeExactCount: sp.exactCount === "1",
  };
}

export function purchaseRequestFiltersFromParsed(parsed: ReturnType<typeof parsePurchaseRequestSearchParams>) {
  return {
    statuses: parsed.statuses.length ? parsed.statuses : undefined,
    categoryId: parsed.categoryId || undefined,
    subcategoryId: parsed.subcategoryId || undefined,
    executionType: parsed.executionTypeParsed,
    warehouseId: parsed.warehouseId || undefined,
    createdById: parsed.createdById || undefined,
    dateFrom: parsed.dateFrom || undefined,
    dateTo: parsed.dateTo || undefined,
    page: parsed.page,
    includeExactCount: parsed.includeExactCount,
  };
}
