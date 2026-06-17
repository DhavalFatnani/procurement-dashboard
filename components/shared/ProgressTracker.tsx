"use client";

import { POStatus } from "@/lib/prisma-enums";

import {
  PRLifecycleStepper,
  type PRLifecycleStepperProps,
} from "@/components/purchase-requests/PRLifecycleStepper";
import { POProgressBar, type POProgressStepKey } from "@/components/shared/POProgressBar";
import { cn } from "@/lib/utils";
import { formatDateTimeMedium } from "@/lib/format-datetime";

type PRLifecycleProps = {
  variant: "stepper";
} & PRLifecycleStepperProps;

type POBarProps = {
  variant: "bar";
  status: POStatus;
  size?: "sm" | "md" | "lg";
  stepCaptions?: Partial<Record<POProgressStepKey, string>>;
  showLabels?: boolean;
  className?: string;
};

type DotsStep = {
  key: string;
  label: string;
  done: boolean;
  completedAt?: Date | string | null;
};

type DotsProps = {
  variant: "dots";
  steps: DotsStep[];
  className?: string;
};

export type ProgressTrackerProps = PRLifecycleProps | POBarProps | DotsProps;

export function ProgressTracker(props: ProgressTrackerProps) {
  if (props.variant === "stepper") {
    const { variant: stepperVariant, ...rest } = props;
    void stepperVariant;
    return <PRLifecycleStepper {...rest} />;
  }

  if (props.variant === "bar") {
    const { variant: barVariant, ...rest } = props;
    void barVariant;
    return <POProgressBar {...rest} />;
  }

  const { steps, className } = props;
  return (
    <ol className={cn("space-y-3", className)}>
      {steps.map((step) => (
        <li key={step.key} className="flex gap-3 text-ds-sm">
          <span
            className={cn(
              "mt-1.5 size-2 shrink-0 rounded-full transition-colors duration-fast",
              step.done
                ? "bg-[var(--status-success)]"
                : "bg-muted-foreground/40",
            )}
            aria-hidden
          />
          <div>
            <p className={cn("font-medium", !step.done && "text-muted-foreground")}>
              {step.label}
            </p>
            <p className="text-ds-xs text-muted-foreground">
              {step.done && step.completedAt
                ? formatDateTimeMedium(
                    step.completedAt instanceof Date
                      ? step.completedAt.toISOString()
                      : step.completedAt,
                  )
                : step.done
                  ? "Completed"
                  : "Pending"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
