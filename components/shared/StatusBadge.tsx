import {
  InvoiceMatchStatus,
  PaymentStatus,
  POStatus,
  PRStatus,
} from "@prisma/client";
import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const prVariant: Record<PRStatus, BadgeVariant> = {
  [PRStatus.DRAFT]: "secondary",
  [PRStatus.PENDING_APPROVAL]: "outline",
  [PRStatus.APPROVED]: "default",
  [PRStatus.REJECTED]: "destructive",
  [PRStatus.REVISION_REQUIRED]: "outline",
  [PRStatus.CONVERTED_TO_PO]: "default",
  [PRStatus.EXECUTED_PRINT]: "default",
  [PRStatus.CANCELLED]: "outline",
  [PRStatus.FORCE_CANCELLED]: "destructive",
};

const prClass: Partial<Record<PRStatus, string>> = {
  [PRStatus.PENDING_APPROVAL]: "border-amber-500/50 text-amber-700 dark:text-amber-400",
  [PRStatus.REVISION_REQUIRED]: "border-amber-500/50 text-amber-700 dark:text-amber-400",
  [PRStatus.CANCELLED]: "text-muted-foreground",
};

const poVariant: Record<POStatus, BadgeVariant> = {
  [POStatus.OPEN]: "outline",
  [POStatus.PARTIALLY_RECEIVED]: "outline",
  [POStatus.FULLY_RECEIVED]: "default",
  [POStatus.INVOICED]: "default",
  [POStatus.PAID]: "default",
  [POStatus.CLOSED]: "secondary",
  [POStatus.PARTIALLY_CLOSED]: "outline",
  [POStatus.FORCE_CLOSED]: "destructive",
};

const poClass: Partial<Record<POStatus, string>> = {
  [POStatus.OPEN]: "border-sky-500/40 text-sky-800 dark:text-sky-300",
  [POStatus.PARTIALLY_RECEIVED]: "border-sky-500/40 text-sky-800 dark:text-sky-300",
  [POStatus.PARTIALLY_CLOSED]: "border-amber-500/50 text-amber-800 dark:text-amber-300",
};

const paymentVariant: Record<PaymentStatus, BadgeVariant> = {
  [PaymentStatus.UNPAID]: "outline",
  [PaymentStatus.PARTIALLY_PAID]: "outline",
  [PaymentStatus.PAID]: "default",
};

const paymentClass: Partial<Record<PaymentStatus, string>> = {
  [PaymentStatus.UNPAID]: "border-rose-500/40 text-rose-800 dark:text-rose-300",
  [PaymentStatus.PARTIALLY_PAID]: "border-amber-500/50 text-amber-800 dark:text-amber-300",
};

const invoiceVariant: Record<InvoiceMatchStatus, BadgeVariant> = {
  [InvoiceMatchStatus.PENDING]: "outline",
  [InvoiceMatchStatus.MATCHED]: "default",
  [InvoiceMatchStatus.MISMATCH]: "destructive",
  [InvoiceMatchStatus.OVERRIDE_ACCEPTED]: "secondary",
};

const invoiceClass: Partial<Record<InvoiceMatchStatus, string>> = {
  [InvoiceMatchStatus.PENDING]: "border-amber-500/50 text-amber-800 dark:text-amber-300",
};

export type StatusBadgeProps =
  | { kind: "PRStatus"; status: PRStatus }
  | { kind: "POStatus"; status: POStatus }
  | { kind: "PaymentStatus"; status: PaymentStatus }
  | { kind: "InvoiceMatchStatus"; status: InvoiceMatchStatus };

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export function StatusBadge(props: StatusBadgeProps) {
  switch (props.kind) {
    case "PRStatus":
      return (
        <Badge variant={prVariant[props.status]} className={cn(prClass[props.status])}>
          {formatStatus(props.status)}
        </Badge>
      );
    case "POStatus":
      return (
        <Badge variant={poVariant[props.status]} className={cn(poClass[props.status])}>
          {formatStatus(props.status)}
        </Badge>
      );
    case "PaymentStatus":
      return (
        <Badge variant={paymentVariant[props.status]} className={cn(paymentClass[props.status])}>
          {formatStatus(props.status)}
        </Badge>
      );
    case "InvoiceMatchStatus":
      return (
        <Badge variant={invoiceVariant[props.status]} className={cn(invoiceClass[props.status])}>
          {formatStatus(props.status)}
        </Badge>
      );
  }
}
