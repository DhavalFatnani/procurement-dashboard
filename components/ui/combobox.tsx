"use client";

import { Check, ChevronDown, X } from "lucide-react";
import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { selectTriggerVariants } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Optional search keywords appended to label for filtering. */
  keywords?: string[];
};

export type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  /** Show an inline X button to clear the selection (yields empty string). */
  allowClear?: boolean;
  /** Label for an "all / clear" item rendered at the top of the list. */
  clearLabel?: string;
  /** Sentinel value emitted when the clear item is chosen. */
  clearValue?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  /** Override the displayed trigger text. */
  renderValue?: (option: ComboboxOption | undefined) => React.ReactNode;
  /**
   * Fired when an option is hovered or focused (before selection). Use it to
   * prefetch the option's detail on intent so the eventual click is instant.
   */
  onHighlight?: (value: string) => void;
};

/**
 * Searchable single-select built on Popover + cmdk. Drop-in replacement for
 * a Radix Select when the option list is long enough to benefit from search
 * (vendor pickers, PO pickers, etc.).
 *
 * The trigger reuses `selectTriggerVariants` so it visually matches the
 * non-searchable `Select` next to it on the same form.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select an option…",
  searchPlaceholder = "Search…",
  emptyText = "No matches found.",
  size = "md",
  disabled,
  loading,
  loadingText = "Loading…",
  allowClear,
  clearLabel,
  clearValue = "",
  ariaLabel,
  className,
  triggerClassName,
  contentClassName,
  renderValue,
  onHighlight,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((opt) => opt.value === value);
  const hasValue = value !== "" && value !== clearValue;

  function handleSelect(next: string) {
    onChange(next);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange(clearValue);
  }

  const triggerLabel = renderValue
    ? renderValue(selected)
    : selected
      ? selected.label
      : null;

  return (
    <div className={cn("inline-flex w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            disabled={disabled || loading}
            className={cn(selectTriggerVariants({ size }), triggerClassName)}
            data-state={open ? "open" : "closed"}
            data-placeholder={!hasValue ? "" : undefined}
          >
            <span
              className={cn(
                "line-clamp-1 text-left",
                !hasValue && "text-muted-foreground/70",
              )}
            >
              {loading
                ? loadingText
                : triggerLabel
                  ? triggerLabel
                  : placeholder}
            </span>
            <div className="ml-1 flex shrink-0 items-center gap-1">
              {allowClear && hasValue && !loading ? (
                <span
                  role="button"
                  aria-label="Clear selection"
                  tabIndex={-1}
                  onClick={handleClear}
                  className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3" strokeWidth={2} aria-hidden />
                </span>
              ) : null}
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-md text-muted-foreground",
                  "transition-[background-color,color] duration-fast",
                  open ? "bg-secondary text-foreground" : "",
                )}
                aria-hidden
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-fast",
                    open && "rotate-180",
                  )}
                  strokeWidth={1.75}
                />
              </span>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className={cn(
            "w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0",
            contentClassName,
          )}
        >
          <Command
            filter={(itemValue, search, keywords) => {
              const haystack = `${itemValue} ${(keywords ?? []).join(" ")}`.toLowerCase();
              return haystack.includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {clearLabel ? (
                  <CommandItem
                    value={clearLabel}
                    onSelect={() => handleSelect(clearValue)}
                    className="text-muted-foreground"
                  >
                    <span className="flex size-3.5 items-center justify-center text-[var(--brand-accent)]">
                      {!hasValue ? (
                        <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
                      ) : null}
                    </span>
                    <span className="flex-1">{clearLabel}</span>
                  </CommandItem>
                ) : null}
                {options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <CommandItem
                      key={opt.value}
                      value={`${opt.label} ${opt.description ?? ""}`}
                      keywords={opt.keywords}
                      disabled={opt.disabled}
                      onSelect={() => handleSelect(opt.value)}
                      onMouseEnter={
                        opt.disabled ? undefined : () => onHighlight?.(opt.value)
                      }
                      onFocus={opt.disabled ? undefined : () => onHighlight?.(opt.value)}
                    >
                      <span className="flex size-3.5 items-center justify-center text-[var(--brand-accent)]">
                        {isSelected ? (
                          <Check
                            className="size-3.5"
                            strokeWidth={2.25}
                            aria-hidden
                          />
                        ) : null}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={cn(
                            "truncate",
                            isSelected && "font-medium",
                          )}
                        >
                          {opt.label}
                        </span>
                        {opt.description ? (
                          <span className="truncate text-ds-xs text-muted-foreground">
                            {opt.description}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
