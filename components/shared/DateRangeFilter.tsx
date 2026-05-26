"use client";

import { CalendarRange } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Filter-bar date range control.
 *
 * Two native date inputs styled to match the rest of the filter row: matched
 * `h-8`, consistent fixed widths, leading calendar icon, and standardised
 * `aria-label`s ("From date" / "To date").
 *
 * Native `<input type="date">` is preserved (vs a custom datepicker) so the
 * OS picker keeps full keyboard accessibility.
 *
 * Pass `onFromChange` / `onToChange` to enable auto-apply UX.
 */
export function DateRangeFilter({
  fromName = "dateFrom",
  toName = "dateTo",
  defaultFrom,
  defaultTo,
  className,
  onFromChange,
  onToChange,
}: {
  fromName?: string;
  toName?: string;
  defaultFrom?: string;
  defaultTo?: string;
  className?: string;
  onFromChange?: (value: string) => void;
  onToChange?: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-input pl-2 pr-1 transition-[border,box-shadow] duration-fast focus-within:border-[var(--brand-accent)] focus-within:shadow-ds-focus",
        className,
      )}
    >
      <CalendarRange
        className="size-3.5 shrink-0 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
      <Input
        type="date"
        name={fromName}
        defaultValue={defaultFrom}
        aria-label="From date"
        className="h-7 w-[122px] border-0 bg-transparent px-1.5 text-ds-xs shadow-none focus-visible:shadow-none"
        onChange={onFromChange ? (e) => onFromChange(e.target.value) : undefined}
      />
      <span className="text-ds-xs text-muted-foreground/70" aria-hidden>
        →
      </span>
      <Input
        type="date"
        name={toName}
        defaultValue={defaultTo}
        aria-label="To date"
        className="h-7 w-[122px] border-0 bg-transparent px-1.5 text-ds-xs shadow-none focus-visible:shadow-none"
        onChange={onToChange ? (e) => onToChange(e.target.value) : undefined}
      />
    </div>
  );
}
