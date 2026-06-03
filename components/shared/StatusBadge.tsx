import {
  InvoiceMatchStatus,
  PaymentStatus,
  POStatus,
  PRStatus,
  VendorStatus,
} from "@/lib/prisma-enums";
import { memo } from "react";

import { Chip, type ChipTone } from "@/components/shared/Chip";

const prTone: Record<PRStatus, ChipTone> = {
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

const poTone: Record<POStatus, ChipTone> = {
  [POStatus.OPEN]: "neutral",
  [POStatus.PARTIALLY_RECEIVED]: "warning",
  [POStatus.FULLY_RECEIVED]: "info",
  [POStatus.INVOICED]: "info",
  [POStatus.PAID]: "info",
  [POStatus.CLOSED]: "success",
  [POStatus.PARTIALLY_CLOSED]: "success",
  [POStatus.FORCE_CLOSED]: "neutral",
};

const paymentTone: Record<PaymentStatus, ChipTone> = {
  [PaymentStatus.UNPAID]: "error",
  [PaymentStatus.PARTIALLY_PAID]: "warning",
  [PaymentStatus.PAID]: "success",
};

const invoiceTone: Record<InvoiceMatchStatus, ChipTone> = {
  [InvoiceMatchStatus.PENDING]: "neutral",
  [InvoiceMatchStatus.MATCHED]: "success",
  [InvoiceMatchStatus.MISMATCH]: "error",
  [InvoiceMatchStatus.OVERRIDE_ACCEPTED]: "warning",
};

const vendorTone: Record<VendorStatus, ChipTone> = {
  [VendorStatus.ACTIVE]: "success",
  [VendorStatus.INACTIVE]: "neutral",
};

export type StatusBadgeProps =
  | { kind: "PRStatus"; status: PRStatus; awaitingPurchaseOrder?: boolean }
  | { kind: "POStatus"; status: POStatus }
  | { kind: "PaymentStatus"; status: PaymentStatus }
  | { kind: "InvoiceMatchStatus"; status: InvoiceMatchStatus }
  | { kind: "VendorStatus"; status: VendorStatus };

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export const StatusBadge = memo(function StatusBadge(props: StatusBadgeProps) {
  switch (props.kind) {
    case "PRStatus": {
      const label =
        props.awaitingPurchaseOrder && props.status === PRStatus.APPROVED
          ? "Approved — awaiting PO"
          : formatStatus(props.status);
      return (
        <Chip tone={prTone[props.status]} showDot>
          {label}
        </Chip>
      );
    }
    case "POStatus":
      return (
        <Chip tone={poTone[props.status]} showDot>
          {formatStatus(props.status)}
        </Chip>
      );
    case "PaymentStatus":
      return (
        <Chip tone={paymentTone[props.status]} showDot>
          {formatStatus(props.status)}
        </Chip>
      );
    case "InvoiceMatchStatus":
      return (
        <Chip tone={invoiceTone[props.status]} showDot>
          {formatStatus(props.status)}
        </Chip>
      );
    case "VendorStatus":
      return (
        <Chip tone={vendorTone[props.status]} showDot>
          {formatStatus(props.status)}
        </Chip>
      );
  }
});
