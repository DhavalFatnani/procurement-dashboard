"use client";

import { Check, Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

const STATE_META: Record<AutosaveState, { label: string; className: string }> = {
  idle: {
    label: "All changes saved",
    className: "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]",
  },
  saving: {
    label: "Saving…",
    className: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  },
  saved: {
    label: "Saved",
    className: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  },
  error: {
    label: "Couldn't save",
    className: "bg-[var(--status-error-bg)] text-[var(--status-error)]",
  },
};

/** Inline form autosave indicator chip. */
export function AutosaveChip({
  state,
  hint,
  className,
}: {
  state: AutosaveState;
  hint?: string;
  className?: string;
}) {
  const meta = STATE_META[state];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-ds-2xs font-medium",
        meta.className,
        className,
      )}
    >
      {state === "saving" ? (
        <Loader2 className="size-3 animate-spin" strokeWidth={1.5} aria-hidden />
      ) : state === "saved" ? (
        <Check className="size-3" strokeWidth={1.5} aria-hidden />
      ) : null}
      <span>{hint ?? meta.label}</span>
    </span>
  );
}
