import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ChipTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "accent";

export type ChipSize = "sm" | "md";

const toneStyles: Record<ChipTone, { soft: string; solid: string; outline: string; dot: string }> = {
  neutral: {
    soft: "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]",
    solid: "bg-[var(--status-neutral-strong-bg)] text-[var(--text-on-status)]",
    outline:
      "border border-[var(--status-neutral-border)] text-[var(--text-secondary)] bg-transparent",
    dot: "bg-[var(--status-neutral)]",
  },
  info: {
    soft: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
    solid: "bg-[var(--status-info-strong-bg)] text-[var(--text-on-status)]",
    outline:
      "border border-[var(--status-info-border)] text-[var(--status-info)] bg-transparent",
    dot: "bg-[var(--status-info)]",
  },
  success: {
    soft: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
    solid: "bg-[var(--status-success-strong-bg)] text-[var(--text-on-status)]",
    outline:
      "border border-[var(--status-success-border)] text-[var(--status-success)] bg-transparent",
    dot: "bg-[var(--status-success)]",
  },
  warning: {
    soft: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
    solid: "bg-[var(--status-warning-strong-bg)] text-[var(--text-on-status)]",
    outline:
      "border border-[var(--status-warning-border)] text-[var(--status-warning)] bg-transparent",
    dot: "bg-[var(--status-warning)]",
  },
  error: {
    soft: "bg-[var(--status-error-bg)] text-[var(--status-error)]",
    solid: "bg-[var(--status-error-strong-bg)] text-[var(--text-on-status)]",
    outline:
      "border border-[var(--status-error-border)] text-[var(--status-error)] bg-transparent",
    dot: "bg-[var(--status-error)]",
  },
  accent: {
    soft: "bg-[var(--accent-subtle)] text-[var(--brand-accent)]",
    solid: "bg-[var(--brand-accent)] text-[var(--text-on-accent)]",
    outline:
      "border border-[var(--brand-accent)]/40 text-[var(--brand-accent)] bg-transparent",
    dot: "bg-[var(--brand-accent)]",
  },
};

/**
 * Compact label pill for filters, statuses, counts, and inline metadata.
 *
 * Three visual styles:
 *   - `soft` (default) — tinted background + tinted text
 *   - `solid` — full bg + on-status text (use sparingly, for high-emphasis chips)
 *   - `outline` — border-only (good for filter chips)
 */
export function Chip({
  tone = "neutral",
  size = "md",
  variant = "soft",
  icon: Icon,
  showDot = false,
  onRemove,
  className,
  children,
}: {
  tone?: ChipTone;
  size?: ChipSize;
  variant?: "soft" | "solid" | "outline";
  icon?: LucideIcon;
  /** Render a leading status dot (mutually exclusive with `icon`). */
  showDot?: boolean;
  /** When provided, renders a trailing `×` that calls back. */
  onRemove?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const styles = toneStyles[tone];
  const variantClass =
    variant === "soft" ? styles.soft : variant === "solid" ? styles.solid : styles.outline;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap font-medium leading-snug",
        variantClass,
        size === "sm"
          ? "h-5 gap-1 rounded-full px-1.5 text-ds-2xs"
          : "h-[22px] gap-1.5 rounded-full px-2 text-ds-xs",
        className,
      )}
    >
      {Icon ? <Icon className="size-3" strokeWidth={1.5} aria-hidden /> : null}
      {showDot && !Icon ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", styles.dot)} aria-hidden />
      ) : null}
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="ml-0.5 -mr-0.5 rounded-full p-0.5 hover:bg-foreground/10"
        >
          <X className="size-2.5" strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
