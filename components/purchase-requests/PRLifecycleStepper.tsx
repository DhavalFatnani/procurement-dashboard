"use client";

import { ExecutionType, PRStatus } from "@prisma/client";

import { HorizontalStepper, type StepperStep } from "@/components/shared/Stepper";

type VendorLifecycle = {
  executionType: typeof ExecutionType.VENDOR_PURCHASE;
  status: PRStatus;
  hasPO: boolean;
  hasGRN: boolean;
  hasInvoice: boolean;
  isPaid: boolean;
  cancelled?: boolean;
};

type InternalPrintLifecycle = {
  executionType: typeof ExecutionType.INTERNAL_PRINT;
  status: PRStatus;
  hasSerialReservation: boolean;
  cancelled?: boolean;
};

export type PRLifecycleStepperProps = VendorLifecycle | InternalPrintLifecycle;

const VENDOR_STEPS: { id: string; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "po", label: "PO" },
  { id: "grn", label: "GRN" },
  { id: "invoice", label: "Invoiced" },
  { id: "paid", label: "Paid" },
];

const INTERNAL_PRINT_STEPS: { id: string; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "reserved", label: "Range reserved" },
  { id: "printed", label: "Labels printed" },
];

function computeVendorStates({
  status,
  hasPO,
  hasGRN,
  hasInvoice,
  isPaid,
  cancelled,
}: Omit<VendorLifecycle, "executionType">): StepperStep["state"][] {
  if (cancelled) {
    return VENDOR_STEPS.map(() => "cancelled" as const);
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
  return VENDOR_STEPS.map((_, i): StepperStep["state"] => {
    if (i < cursor) return "done";
    if (i === cursor) return "active";
    return "pending";
  });
}

function computeInternalPrintStates({
  status,
  hasSerialReservation,
  cancelled,
}: Omit<InternalPrintLifecycle, "executionType">): StepperStep["state"][] {
  if (cancelled) {
    return INTERNAL_PRINT_STEPS.map(() => "cancelled" as const);
  }
  if (status === PRStatus.EXECUTED_PRINT && hasSerialReservation) {
    return ["done", "done", "done"];
  }
  if (hasSerialReservation) {
    return ["done", "done", "active"];
  }
  return ["active", "pending", "pending"];
}

export function PRLifecycleStepper(props: PRLifecycleStepperProps) {
  if (props.executionType === ExecutionType.INTERNAL_PRINT) {
    const states = computeInternalPrintStates(props);
    const steps: StepperStep[] = INTERNAL_PRINT_STEPS.map((step, i) => ({
      id: step.id,
      label: step.label,
      state: states[i]!,
    }));
    return <HorizontalStepper steps={steps} />;
  }

  const states = computeVendorStates(props);
  const steps: StepperStep[] = VENDOR_STEPS.map((step, i) => ({
    id: step.id,
    label: step.label,
    state: states[i]!,
  }));
  return <HorizontalStepper steps={steps} />;
}
