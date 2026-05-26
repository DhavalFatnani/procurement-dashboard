"use client";

import * as React from "react";

import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Filter-bar `Select` wrapper that solves two Radix constraints:
 *
 * 1. `SelectItem` values can never be empty strings. We use a `"__all"`
 *    sentinel internally for the "All X" option so call sites can keep
 *    treating empty string as "no filter".
 * 2. Radix `Select` doesn't render a native `<select>` for form submission.
 *    We render a hidden `<input name=…>` next to the trigger so existing
 *    filter-form `FormData` flows continue to work.
 *
 * Pass `allOptionLabel={null}` to omit the "All X" item entirely. Pass
 * `searchable` (auto-enables when options.length > 8) to swap the menu
 * for a searchable `Combobox` — vendor/PO pickers benefit most.
 */
export const FILTER_ALL_VALUE = "__all";

const SEARCHABLE_THRESHOLD = 8;

export type FilterSelectOption = {
  value: string;
  label: React.ReactNode;
  /** Optional secondary line (description) shown under the label. */
  description?: string;
};

export function FilterSelect({
  name,
  defaultValue = "",
  placeholder,
  allOptionLabel,
  options,
  ariaLabel,
  className,
  triggerClassName,
  searchable,
  searchPlaceholder,
  emptyText,
  onValueChange,
}: {
  name: string;
  /** Empty string = "all"; treated as the sentinel internally. */
  defaultValue?: string;
  /** Placeholder shown in trigger when nothing is selected. */
  placeholder?: string;
  /**
   * Label for the "All …" option at the top of the menu. Defaults to the
   * placeholder. Pass `null` to omit the option entirely.
   */
  allOptionLabel?: React.ReactNode | null;
  options: FilterSelectOption[];
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  /**
   * Force searchable mode (Combobox). When undefined, auto-enables for lists
   * larger than {@link SEARCHABLE_THRESHOLD} entries.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /**
   * Fires whenever the user picks a new option. Receives the submit-shape value
   * (empty string for "all"). Use this for auto-apply filter UX in addition to
   * (or instead of) form submission.
   */
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = React.useState<string>(
    defaultValue || FILTER_ALL_VALUE,
  );

  React.useEffect(() => {
    setValue(defaultValue || FILTER_ALL_VALUE);
  }, [defaultValue]);

  const handleChange = React.useCallback(
    (next: string) => {
      setValue(next);
      if (onValueChange) {
        onValueChange(next === FILTER_ALL_VALUE ? "" : next);
      }
    },
    [onValueChange],
  );

  const submitValue = value === FILTER_ALL_VALUE ? "" : value;
  const allLabel = allOptionLabel === undefined ? placeholder : allOptionLabel;
  const useCombobox =
    searchable === true ||
    (searchable === undefined && options.length > SEARCHABLE_THRESHOLD);

  if (useCombobox) {
    const clearLabel =
      allLabel != null
        ? typeof allLabel === "string"
          ? allLabel
          : (placeholder ?? "All")
        : undefined;

    return (
      <div className={cn("inline-flex", className)}>
        <input type="hidden" name={name} value={submitValue} />
        <Combobox
          value={submitValue}
          onChange={(next) =>
            handleChange(next === "" ? FILTER_ALL_VALUE : next)
          }
          options={options.map((opt) => ({
            value: opt.value,
            label: typeof opt.label === "string" ? opt.label : String(opt.label),
            description: opt.description,
          }))}
          placeholder={placeholder ?? "Select…"}
          searchPlaceholder={searchPlaceholder ?? "Search…"}
          emptyText={emptyText ?? "No matches found."}
          ariaLabel={ariaLabel}
          size="sm"
          clearLabel={clearLabel}
          clearValue=""
          triggerClassName={triggerClassName}
        />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex", className)}>
      <input type="hidden" name={name} value={submitValue} />
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger
          size="sm"
          className={triggerClassName}
          aria-label={ariaLabel}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allLabel != null ? (
            <SelectItem value={FILTER_ALL_VALUE}>{allLabel}</SelectItem>
          ) : null}
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              description={opt.description}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
