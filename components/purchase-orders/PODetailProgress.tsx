import { POStatus } from "@prisma/client";

import { formatDateMedium } from "@/lib/format-datetime";
import type { PODetail } from "@/lib/queries/purchase-orders";
import { cn } from "@/lib/utils";

type StepKey =
  | "open"
  | "partial"
  | "received"
  | "invoiced"
  | "paid"
  | "closed";

const STEPS: { key: StepKey; label: string; description: string }[] = [
  { key: "open", label: "Open", description: "Sent to vendor" },
  {
    key: "partial",
    label: "Partial receipt",
    description: "First goods received",
  },
  {
    key: "received",
    label: "Fully received",
    description: "All goods received",
  },
  { key: "invoiced", label: "Invoiced", description: "Vendor invoice on file" },
  { key: "paid", label: "Paid", description: "Disbursed to vendor" },
  { key: "closed", label: "Closed", description: "Lifecycle complete" },
];

function statusIndex(status: POStatus): number {
  switch (status) {
    case POStatus.OPEN:
      return 0;
    case POStatus.PARTIALLY_RECEIVED:
      return 1;
    case POStatus.FULLY_RECEIVED:
      return 2;
    case POStatus.INVOICED:
      return 3;
    case POStatus.PAID:
      return 4;
    case POStatus.CLOSED:
    case POStatus.PARTIALLY_CLOSED:
    case POStatus.FORCE_CLOSED:
      return 5;
  }
}

/**
 * Vertical dot stepper for the PO side panel. Each step is marked done /
 * active / upcoming and decorated with a date drawn from the PO itself
 * where one is available (GRN receipts, invoice uploads, PO creation).
 */
export function PODetailProgress({ po }: { po: PODetail }) {
  const current = statusIndex(po.status);
  const firstGrnAt = po.grns.length
    ? [...po.grns]
        .map((g) => g.receivedAt)
        .sort()
        [0]
    : undefined;
  const lastGrnAt = po.grns.length
    ? [...po.grns]
        .map((g) => g.receivedAt)
        .sort()
        .at(-1)
    : undefined;
  const firstInvoiceAt = po.invoices.length
    ? [...po.invoices]
        .map((i) => i.createdAt)
        .sort()
        [0]
    : undefined;

  const dateByKey: Partial<Record<StepKey, string>> = {
    open: po.createdAt,
    partial: firstGrnAt,
    received:
      po.status === POStatus.FULLY_RECEIVED ||
      po.status === POStatus.INVOICED ||
      po.status === POStatus.PAID ||
      po.status === POStatus.CLOSED
        ? lastGrnAt
        : undefined,
    invoiced: firstInvoiceAt,
  };

  return (
    <ol className="space-y-3">
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const date = dateByKey[step.key];
        return (
          <li key={step.key} className="flex items-start gap-2.5">
            <span className="relative mt-0.5 flex size-4 items-center justify-center">
              <span
                className={cn(
                  "block size-2.5 rounded-full transition-colors duration-fast",
                  done && "bg-[var(--brand-accent)]",
                  active &&
                    "bg-[var(--brand-accent)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand-accent)_25%,transparent)]",
                  !done && !active && "bg-border",
                )}
                aria-hidden
              />
              {index < STEPS.length - 1 ? (
                <span
                  className={cn(
                    "absolute left-1/2 top-3.5 h-4 w-px -translate-x-1/2",
                    done ? "bg-[var(--brand-accent)]/60" : "bg-border-subtle",
                  )}
                  aria-hidden
                />
              ) : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={cn(
                  "text-ds-sm",
                  active && "font-medium text-foreground",
                  done && "text-foreground",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              <span className="text-ds-2xs text-muted-foreground">
                {date ? formatDateMedium(date) : step.description}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
