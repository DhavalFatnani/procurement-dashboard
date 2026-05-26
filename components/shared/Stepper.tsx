import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StepperStep = {
  id: string;
  label: string;
  description?: string;
  /** `done` < `active` < `pending`. `cancelled` shows a dimmed dot. */
  state?: "done" | "active" | "pending" | "cancelled";
  meta?: ReactNode;
};

/**
 * Horizontal step indicator used for entity lifecycles (PR, GRN, etc.).
 *
 * Steps marked `done` get a check, `active` gets an accented filled ring, and
 * `pending` is muted. Use `state` directly if the entity status doesn't map
 * cleanly to ordinal position.
 */
export function Stepper({ steps, className }: { steps: StepperStep[]; className?: string }) {
  return (
    <ol
      className={cn(
        "flex w-full items-start gap-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="list"
    >
      {steps.map((step, i) => {
        const state = step.state ?? "pending";
        const isLast = i === steps.length - 1;

        return (
          <li key={step.id} className="flex flex-1 min-w-0 items-start gap-2">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-ds-2xs font-semibold transition-colors duration-fast",
                  state === "done"
                    ? "border-transparent bg-[var(--brand-accent)] text-[var(--text-on-accent)]"
                    : state === "active"
                      ? "border-[var(--brand-accent)] bg-[var(--accent-subtle)] text-[var(--brand-accent)]"
                      : state === "cancelled"
                        ? "border-border-subtle bg-muted text-muted-foreground/50"
                        : "border-border-subtle bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {state === "done" ? <Check className="size-3" strokeWidth={2.5} /> : i + 1}
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    "mt-1 h-6 w-px",
                    state === "done"
                      ? "bg-[var(--brand-accent)]/40"
                      : "bg-border-subtle",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-2 pt-0.5">
              <p
                className={cn(
                  "truncate text-ds-sm font-medium",
                  state === "active"
                    ? "text-foreground"
                    : state === "done"
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              {step.description ? (
                <p className="truncate text-ds-xs text-muted-foreground">{step.description}</p>
              ) : null}
              {step.meta ? <div className="mt-1">{step.meta}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Horizontal compact stepper variant — chips connected by lines, no vertical
 * stack. Useful inside detail-page hero rows.
 */
export function HorizontalStepper({
  steps,
  className,
}: {
  steps: StepperStep[];
  className?: string;
}) {
  return (
    <ol className={cn("flex w-full items-center gap-1", className)} role="list">
      {steps.map((step, i) => {
        const state = step.state ?? "pending";
        const isLast = i === steps.length - 1;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-1">
            <div className="flex flex-col items-center text-center min-w-0">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-ds-2xs font-semibold transition-colors duration-fast",
                  state === "done"
                    ? "border-transparent bg-[var(--brand-accent)] text-[var(--text-on-accent)]"
                    : state === "active"
                      ? "border-[var(--brand-accent)] bg-[var(--accent-subtle)] text-[var(--brand-accent)]"
                      : "border-border-subtle bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {state === "done" ? <Check className="size-2.5" strokeWidth={2.5} /> : i + 1}
              </span>
              <span
                className={cn(
                  "mt-1 truncate text-ds-2xs",
                  state === "active" || state === "done"
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast ? (
              <span
                className={cn(
                  "h-px flex-1",
                  state === "done" ? "bg-[var(--brand-accent)]/40" : "bg-border-subtle",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
