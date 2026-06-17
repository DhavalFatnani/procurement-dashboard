"use client";

import { isCentralOpsOrAbove } from "@/lib/admin-access";
import { ExecutionType, PRStatus, Role } from "@/lib/prisma-enums";
import * as React from "react";

import type {
  CategoryOption,
  SubcategoryOption,
  UserOption,
  WarehouseOption,
} from "@/lib/queries/purchase-requests";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import { formatDateMedium } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

export type PurchaseRequestsFiltersValue = {
  statuses: PRStatus[];
  categoryId: string;
  subcategoryId: string;
  executionType: string;
  warehouseId: string;
  createdById: string;
  dateFrom: string;
  dateTo: string;
};

const ALL_STATUSES = Object.values(PRStatus);

/**
 * Persistent filter bar for the Purchase Requests list. Lives **outside** the
 * Suspense boundary so it never unmounts while the table re-fetches.
 *
 * All controls auto-apply on change — no Apply button needed. Status pills are
 * controlled checkboxes that fire `setStatusFilters` immediately.
 */
export function PurchaseRequestsFilters({
  role,
  filters,
  filterOptions,
  setFilter,
  setStatusFilters,
  clearFilter,
  clearStatus,
  clearAllFilters,
}: {
  role: Role;
  filters: PurchaseRequestsFiltersValue;
  filterOptions: {
    categories: CategoryOption[];
    subcategories: SubcategoryOption[];
    warehouses: WarehouseOption[];
    creators: UserOption[];
  };
  setFilter: (
    key:
      | "categoryId"
      | "subcategoryId"
      | "executionType"
      | "warehouseId"
      | "createdById"
      | "dateFrom"
      | "dateTo",
    value: string,
  ) => void;
  setStatusFilters: (statuses: PRStatus[]) => void;
  clearFilter: (
    key:
      | "categoryId"
      | "subcategoryId"
      | "executionType"
      | "warehouseId"
      | "createdById"
      | "dateFrom"
      | "dateTo",
  ) => void;
  clearStatus: (status: PRStatus) => void;
  clearAllFilters: () => void;
}) {
  const isOps = isCentralOpsOrAbove(role);

  const subcatsForCategory = filterOptions.subcategories.filter(
    (s) => !filters.categoryId || s.categoryId === filters.categoryId,
  );

  const category = filters.categoryId
    ? filterOptions.categories.find((c) => c.id === filters.categoryId)
    : null;
  const subcategory = filters.subcategoryId
    ? filterOptions.subcategories.find((s) => s.id === filters.subcategoryId)
    : null;
  const warehouse = filters.warehouseId
    ? filterOptions.warehouses.find((w) => w.id === filters.warehouseId)
    : null;
  const creator = filters.createdById
    ? filterOptions.creators.find((u) => u.id === filters.createdById)
    : null;

  const chipSpecs: FilterChipSpec[] = compactChipSpecs([
    ...filters.statuses.map((status) => ({
      key: `status-${status}`,
      tone: "info" as const,
      label: status.replaceAll("_", " "),
      onClear: () => clearStatus(status),
    })),
    category && {
      key: "category",
      tone: "accent",
      label: `Category: ${category.name}`,
      onClear: () => clearFilter("categoryId"),
    },
    subcategory && {
      key: "subcategory",
      tone: "accent",
      label: `Subcategory: ${subcategory.name}`,
      onClear: () => clearFilter("subcategoryId"),
    },
    filters.executionType && {
      key: "executionType",
      tone: "neutral",
      label: `Type: ${filters.executionType.replaceAll("_", " ")}`,
      onClear: () => clearFilter("executionType"),
    },
    warehouse && {
      key: "warehouse",
      tone: "neutral",
      label: `Warehouse: ${warehouse.label}`,
      onClear: () => clearFilter("warehouseId"),
    },
    creator && {
      key: "creator",
      tone: "neutral",
      label: `By: ${creator.name}`,
      onClear: () => clearFilter("createdById"),
    },
    filters.dateFrom && {
      key: "dateFrom",
      tone: "neutral",
      label: `From ${formatDateMedium(filters.dateFrom)}`,
      onClear: () => clearFilter("dateFrom"),
    },
    filters.dateTo && {
      key: "dateTo",
      tone: "neutral",
      label: `To ${formatDateMedium(filters.dateTo)}`,
      onClear: () => clearFilter("dateTo"),
    },
  ]);

  function handleStatusToggle(status: PRStatus, checked: boolean) {
    const next = checked
      ? [...filters.statuses, status]
      : filters.statuses.filter((s) => s !== status);
    setStatusFilters(next);
  }

  return (
    <div className="space-y-3">
      <FilterBar
        activeChips={
          chipSpecs.length > 0 ? (
            <FilterChipsRow chips={chipSpecs} onClearAll={clearAllFilters} />
          ) : undefined
        }
      >
        <FilterSelect
          name="categoryId"
          defaultValue={filters.categoryId}
          placeholder="All categories"
          ariaLabel="Category"
          triggerClassName="w-[160px]"
          onValueChange={(v) => setFilter("categoryId", v)}
          options={filterOptions.categories.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
        <FilterSelect
          name="subcategoryId"
          defaultValue={filters.subcategoryId}
          placeholder="All subcategories"
          ariaLabel="Subcategory"
          triggerClassName="w-[180px]"
          onValueChange={(v) => setFilter("subcategoryId", v)}
          options={subcatsForCategory.map((s) => ({
            value: s.id,
            label: s.name,
          }))}
        />
        <FilterSelect
          name="executionType"
          defaultValue={filters.executionType}
          placeholder="All types"
          ariaLabel="Execution type"
          triggerClassName="w-[160px]"
          onValueChange={(v) => setFilter("executionType", v)}
          options={[
            { value: ExecutionType.VENDOR_PURCHASE, label: "Vendor purchase" },
            { value: ExecutionType.INTERNAL_PRINT, label: "Internal print" },
          ]}
        />
        {isOps ? (
          <FilterSelect
            name="warehouseId"
            defaultValue={filters.warehouseId}
            placeholder="All warehouses"
            ariaLabel="Warehouse"
            triggerClassName="w-[160px]"
            onValueChange={(v) => setFilter("warehouseId", v)}
            options={filterOptions.warehouses.map((w) => ({
              value: w.id,
              label: w.label,
            }))}
          />
        ) : null}
        {isOps ? (
          <FilterSelect
            name="createdById"
            defaultValue={filters.createdById}
            placeholder="All creators"
            ariaLabel="Created by"
            triggerClassName="w-[160px]"
            onValueChange={(v) => setFilter("createdById", v)}
            options={filterOptions.creators.map((u) => ({
              value: u.id,
              label: u.name,
            }))}
          />
        ) : null}
        <DateRangeFilter
          defaultFrom={filters.dateFrom}
          defaultTo={filters.dateTo}
          onFromChange={(v) => setFilter("dateFrom", v)}
          onToChange={(v) => setFilter("dateTo", v)}
        />
      </FilterBar>

      <div
        role="group"
        aria-label="Status filters"
        className="flex flex-wrap items-center gap-1.5"
      >
        <span className="mr-1 text-ds-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </span>
        {ALL_STATUSES.map((s) => {
          const checked = filters.statuses.includes(s);
          return (
            <label
              key={s}
              className={cn(
                "inline-flex h-[26px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-ds-xs font-medium transition-colors duration-fast",
                checked
                  ? "border-[var(--brand-accent)]/40 bg-[var(--accent-subtle)] text-[var(--brand-accent)]"
                  : "border-border-subtle bg-card text-muted-foreground hover:border-border-default hover:text-foreground",
              )}
            >
              <input
                type="checkbox"
                value={s}
                checked={checked}
                onChange={(e) => handleStatusToggle(s, e.target.checked)}
                className="sr-only"
              />
              {s.replaceAll("_", " ")}
            </label>
          );
        })}
      </div>
    </div>
  );
}
