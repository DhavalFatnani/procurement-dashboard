"use client";

import { X } from "lucide-react";

import { Chip } from "@/components/shared/Chip";
import type { FilterChipSpec } from "@/lib/filter-chips";

/**
 * Renders the active-filter chip row inside `FilterBar` plus a "Clear all"
 * affordance when more than one chip is present.
 */
export function FilterChipsRow({
  chips,
  onClearAll,
}: {
  chips: FilterChipSpec[];
  onClearAll?: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          variant="outline"
          tone={chip.tone ?? "neutral"}
          onRemove={chip.onClear}
        >
          {chip.label}
        </Chip>
      ))}
      {chips.length > 1 && onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 inline-flex h-[22px] items-center gap-0.5 rounded-full px-1.5 text-ds-2xs font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground"
        >
          <X className="size-2.5" strokeWidth={1.5} aria-hidden />
          Clear all
        </button>
      ) : null}
    </>
  );
}
