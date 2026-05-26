import type { ReactNode } from "react";

import type { ChipTone } from "@/components/shared/Chip";

export type FilterChipSpec = {
  /** React key — keep stable across renders. */
  key: string;
  tone?: ChipTone;
  label: ReactNode;
  onClear: () => void;
};

/**
 * Builds a list of chip specs from a sparse input, dropping falsy entries.
 * Used by every list-view filter bar so the chip wiring is uniform.
 *
 * Accepts falsy literal values (empty string, null, undefined, false) so call
 * sites can use `value && { key, label, ... }` without ts-narrowing the value.
 */
export function compactChipSpecs(
  specs: Array<FilterChipSpec | null | undefined | false | "">,
): FilterChipSpec[] {
  return specs.filter((s): s is FilterChipSpec => Boolean(s));
}
