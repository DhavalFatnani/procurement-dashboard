"use client";

import { Search } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Standardised free-text search control for filter bars.
 *
 * Renders a leading `Search` icon and an `Input` styled to match the rest of
 * the filter row (h-8 by default). Use inside a `<form>` so the parent submit
 * picks up the value via `name`.
 */
export function FilterSearch({
  name,
  defaultValue = "",
  placeholder = "Search…",
  className,
  ariaLabel,
  width = "w-[200px]",
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  /** Tailwind width token — defaults to a comfortable 200px. */
  width?: string;
}) {
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return (
    <div
      className={cn(
        "relative inline-flex items-center",
        className,
      )}
    >
      <Search
        className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
      <Input
        type="search"
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn("h-8 pl-7", width)}
      />
    </div>
  );
}
