"use client";

import { PRStatus } from "@prisma/client";

import { HorizontalStepper, type StepperStep } from "@/components/shared/Stepper";

type Lifecycle = {
  status: PRStatus;
  hasPO: boolean;
  hasGRN: boolean;
  hasInvoice: boolean;
  isPaid: boolean;
  cancelled?: boolean;
};

const LIFECYCLE_STEPS: { id: string; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "po", label: "PO" },
  { id: "grn", label: "GRN" },
  { id: "invoice", label: "Invoiced" },
  { id: "paid", label: "Paid" },
];

function computeStates({
  status,
  hasPO,
  hasGRN,
  hasInvoice,
  isPaid,
  cancelled,
}: Lifecycle): StepperStep["state"][] {
  if (cancelled) {
    return LIFECYCLE_STEPS.map(() => "cancelled" as const);
  }
  const cursor =
    isPaid
      ? 6
      : hasInvoice
        ? 5
        : hasGRN
          ? 4
          : hasPO
            ? 3
            : status === PRStatus.APPROVED || status === PRStatus.CONVERTED_TO_PO
              ? 2
              : status === PRStatus.PENDING_APPROVAL || status === PRStatus.REVISION_REQUIRED
                ? 1
                : 0;
  return LIFECYCLE_STEPS.map((_, i): StepperStep["state"] => {
    if (i < cursor) return "done";
    if (i === cursor) return "active";
    return "pending";
  });
}

export function PRLifecycleStepper(props: Lifecycle) {
  const states = computeStates(props);
  const steps: StepperStep[] = LIFECYCLE_STEPS.map((step, i) => ({
    id: step.id,
    label: step.label,
    state: states[i],
  }));
  return <HorizontalStepper steps={steps} />;
}
