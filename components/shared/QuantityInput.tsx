"use client";

import { Minus, Plus } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function parseDigits(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") {
    return null;
  }
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function clampQuantity(n: number, min: number, max?: number): number {
  let v = Math.max(min, n);
  if (max !== undefined) {
    v = Math.min(max, v);
  }
  return v;
}

export type QuantityInputProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
  inputClassName?: string;
  /** +/- buttons beside the field */
  showSteppers?: boolean;
  size?: "sm" | "default";
  /** When value is 0, show an empty field until the user types or blurs */
  showEmptyWhenZero?: boolean;
};

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  id,
  "aria-label": ariaLabel,
  className,
  inputClassName,
  showSteppers = false,
  size = "default",
  showEmptyWhenZero = false,
}: QuantityInputProps) {
  const displayForValue = React.useCallback(
    (n: number) => {
      if (showEmptyWhenZero && n === 0) {
        return "";
      }
      return String(n);
    },
    [showEmptyWhenZero],
  );

  const [draft, setDraft] = React.useState(() => displayForValue(value));
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) {
      setDraft(displayForValue(value));
    }
  }, [value, displayForValue]);

  const commit = React.useCallback(
    (raw: string) => {
      const parsed = parseDigits(raw);
      const next = clampQuantity(parsed ?? min, min, max);
      setDraft(displayForValue(next));
      onChange(next);
    },
    [min, max, onChange, displayForValue],
  );

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    requestAnimationFrame(() => e.target.select());
  };

  const handleBlur = () => {
    focusedRef.current = false;
    commit(draft);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, "");
    setDraft(next);
    const parsed = parseDigits(next);
    if (parsed !== null) {
      onChange(clampQuantity(parsed, min, max));
    }
  };

  const stepBy = (delta: number) => {
    const base = parseDigits(draft) ?? value;
    commit(String(clampQuantity(base + delta, min, max)));
  };

  const heightClass = size === "sm" ? "h-8" : "h-9";
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  const input = (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      disabled={disabled}
      value={draft}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-label={ariaLabel}
      className={cn(
        heightClass,
        "min-w-[5.5rem] w-full font-tabular-nums text-right text-ds-base sm:min-w-[6rem]",
        showSteppers &&
          "rounded-none border-0 bg-transparent text-center shadow-none focus-visible:shadow-none",
        inputClassName,
      )}
    />
  );

  if (!showSteppers) {
    return <div className={cn("min-w-[5.5rem] max-w-[8rem]", className)}>{input}</div>;
  }

  return (
    <div
      className={cn(
        "inline-flex w-full max-w-[10rem] items-stretch overflow-hidden rounded-md border border-border bg-input",
        "focus-within:border-[var(--brand-accent)] focus-within:shadow-ds-focus",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || atMin}
        aria-label="Decrease quantity"
        className="flex w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted/60 disabled:opacity-40"
        onClick={() => stepBy(-1)}
      >
        <Minus className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{input}</div>
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || atMax}
        aria-label="Increase quantity"
        className="flex w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted/60 disabled:opacity-40"
        onClick={() => stepBy(1)}
      >
        <Plus className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
