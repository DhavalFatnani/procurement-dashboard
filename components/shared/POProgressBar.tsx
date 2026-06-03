"use client";

import { POStatus } from "@/lib/prisma-enums";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as React from "react";

import { cn } from "@/lib/utils";

const STEPS = [
  { key: "OPEN", label: "Open", description: "Sent to vendor" },
  { key: "PARTIALLY_RECEIVED", label: "Partial", description: "Some goods received" },
  { key: "FULLY_RECEIVED", label: "Received", description: "All goods received" },
  { key: "INVOICED", label: "Invoiced", description: "Invoice uploaded" },
  { key: "PAID", label: "Paid", description: "Payment recorded" },
  { key: "CLOSED", label: "Closed", description: "PO closed" },
] as const;

export type POProgressStepKey = (typeof STEPS)[number]["key"];

function stepIndex(status: POStatus): number {
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
    default:
      return 0;
  }
}

export type POProgressBarSize = "sm" | "md" | "lg";

/**
 * 6-segment PO lifecycle bar (Open → Partial → Received → Invoiced → Paid → Closed).
 *
 * Past + current segments are filled with the accent color, current segment
 * gets a subtle pulse glow. Each segment has a tooltip with the step label and
 * (when provided) a per-step caption (counts, dates).
 */
export function POProgressBar({
  status,
  size = "md",
  stepCaptions,
  showLabels = true,
  className,
}: {
  status: POStatus;
  size?: POProgressBarSize;
  /** Optional per-step caption shown in the tooltip body (e.g. "Received 80 / 100"). */
  stepCaptions?: Partial<Record<POProgressStepKey, string>>;
  showLabels?: boolean;
  className?: string;
}) {
  const current = stepIndex(status);
  const isForceClosed = status === POStatus.FORCE_CLOSED;
  const partialClosed = status === POStatus.PARTIALLY_CLOSED;

  const barHeight = size === "sm" ? "h-1" : size === "md" ? "h-1.5" : "h-2";
  const labelClass =
    size === "sm" ? "text-[9px]" : size === "md" ? "text-ds-2xs" : "text-ds-xs";

  return (
    <Tooltip.Provider delayDuration={150}>
      <div
        className={cn(
          "flex w-full min-w-[220px] items-center gap-0.5",
          className,
        )}
        role="img"
        aria-label={`PO progress: ${status.replaceAll("_", " ")}`}
      >
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const finalStep = i === STEPS.length - 1;
          const closedTone = isForceClosed && finalStep ? "muted" : partialClosed && finalStep ? "warning" : "primary";

          const fillClass = active
            ? closedTone === "warning"
              ? "bg-[var(--status-warning)]"
              : closedTone === "muted"
                ? "bg-muted-foreground"
                : "bg-[var(--brand-accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--brand-accent)_30%,transparent)]"
            : done
              ? "bg-[color-mix(in_srgb,var(--brand-accent)_75%,transparent)]"
              : "bg-[var(--surface-hover)]";

          return (
            <Tooltip.Root key={step.key}>
              <Tooltip.Trigger asChild>
                <div
                  className="group/segment flex flex-1 flex-col items-center gap-1"
                  tabIndex={0}
                >
                  <div
                    className={cn(
                      "w-full rounded-full transition-colors duration-fast",
                      barHeight,
                      fillClass,
                    )}
                  />
                  {showLabels ? (
                    <span
                      className={cn(
                        "leading-tight text-muted-foreground",
                        labelClass,
                        (done || active) && "font-medium text-foreground",
                        active && "text-[var(--brand-accent)]",
                      )}
                    >
                      {step.label}
                    </span>
                  ) : null}
                </div>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  sideOffset={6}
                  className="z-50 max-w-[200px] rounded-md border border-border-subtle bg-popover px-2.5 py-1.5 text-ds-xs text-popover-foreground shadow-ds-2 data-[state=delayed-open]:animate-ds-pop-in"
                >
                  <p className="font-medium text-foreground">{step.label}</p>
                  <p className="text-muted-foreground">{step.description}</p>
                  {stepCaptions?.[step.key] ? (
                    <p className="mt-1 font-mono text-ds-2xs text-muted-foreground">
                      {stepCaptions[step.key]}
                    </p>
                  ) : null}
                  <Tooltip.Arrow className="fill-[var(--surface-2)]" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        })}
      </div>
    </Tooltip.Provider>
  );
}
