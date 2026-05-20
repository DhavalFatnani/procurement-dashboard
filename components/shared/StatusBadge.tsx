import {
  InvoiceMatchStatus,
  PaymentStatus,
  POStatus,
  PRStatus,
  VendorStatus,
} from "@prisma/client";

import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "warning" | "info" | "success" | "error";

const toneStyles: Record<
  StatusTone,
  { badge: string; dot: string }
> = {
  neutral: {
    badge: "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]",
    dot: "bg-[var(--status-neutral)]",
  },
  warning: {
    badge: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
    dot: "bg-[var(--status-warning)]",
  },
  info: {
    badge: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
    dot: "bg-[var(--status-info)]",
  },
  success: {
    badge: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
    dot: "bg-[var(--status-success)]",
  },
  error: {
    badge: "bg-[var(--status-error-bg)] text-[var(--status-error)]",
    dot: "bg-[var(--status-error)]",
  },
};

const prTone: Record<PRStatus, StatusTone> = {
  [PRStatus.DRAFT]: "neutral",
  [PRStatus.PENDING_APPROVAL]: "warning",
  [PRStatus.APPROVED]: "info",
  [PRStatus.REVISION_REQUIRED]: "warning",
  [PRStatus.CONVERTED_TO_PO]: "info",
  [PRStatus.EXECUTED_PRINT]: "success",
  [PRStatus.REJECTED]: "error",
  [PRStatus.CANCELLED]: "neutral",
  [PRStatus.FORCE_CANCELLED]: "error",
};

const poTone: Record<POStatus, StatusTone> = {
  [POStatus.OPEN]: "neutral",
  [POStatus.PARTIALLY_RECEIVED]: "warning",
  [POStatus.FULLY_RECEIVED]: "info",
  [POStatus.INVOICED]: "info",
  [POStatus.PAID]: "info",
  [POStatus.CLOSED]: "success",
  [POStatus.PARTIALLY_CLOSED]: "success",
  [POStatus.FORCE_CLOSED]: "neutral",
};

const paymentTone: Record<PaymentStatus, StatusTone> = {
  [PaymentStatus.UNPAID]: "error",
  [PaymentStatus.PARTIALLY_PAID]: "warning",
  [PaymentStatus.PAID]: "success",
};

const invoiceTone: Record<InvoiceMatchStatus, StatusTone> = {
  [InvoiceMatchStatus.PENDING]: "neutral",
  [InvoiceMatchStatus.MATCHED]: "success",
  [InvoiceMatchStatus.MISMATCH]: "error",
  [InvoiceMatchStatus.OVERRIDE_ACCEPTED]: "warning",
};

const vendorTone: Record<VendorStatus, StatusTone> = {
  [VendorStatus.ACTIVE]: "success",
  [VendorStatus.INACTIVE]: "neutral",
};

export type StatusBadgeProps =
  | { kind: "PRStatus"; status: PRStatus }
  | { kind: "POStatus"; status: POStatus }
  | { kind: "PaymentStatus"; status: PaymentStatus }
  | { kind: "InvoiceMatchStatus"; status: InvoiceMatchStatus }
  | { kind: "VendorStatus"; status: VendorStatus };

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function DotStatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const styles = toneStyles[tone];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-ds-xs font-medium leading-snug",
        styles.badge,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", styles.dot)} aria-hidden />
      {label}
    </span>
  );
}

export function StatusBadge(props: StatusBadgeProps) {
  switch (props.kind) {
    case "PRStatus":
      return <DotStatusBadge label={formatStatus(props.status)} tone={prTone[props.status]} />;
    case "POStatus":
      return <DotStatusBadge label={formatStatus(props.status)} tone={poTone[props.status]} />;
    case "PaymentStatus":
      return (
        <DotStatusBadge label={formatStatus(props.status)} tone={paymentTone[props.status]} />
      );
    case "InvoiceMatchStatus":
      return (
        <DotStatusBadge label={formatStatus(props.status)} tone={invoiceTone[props.status]} />
      );
    case "VendorStatus":
      return (
        <DotStatusBadge label={formatStatus(props.status)} tone={vendorTone[props.status]} />
      );
  }
}
