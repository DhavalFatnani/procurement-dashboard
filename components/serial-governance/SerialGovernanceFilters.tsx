"use client";

import { SerialSeries } from "@prisma/client";
import * as React from "react";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { useListTransition } from "@/lib/list-transition-context";
import { getSeriesDisplayName } from "@/lib/serial-series";

export type SerialGovernanceFiltersValue = {
  series: string;
  type: string;
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
};

type FilterKey = "series" | "type" | "warehouseId" | "dateFrom" | "dateTo";

export function SerialGovernanceFilters({
  filters,
  filterOptions,
}: {
  filters: SerialGovernanceFiltersValue;
  filterOptions: { warehouses: { id: string; name: string }[] };
}) {
  const { isPending, navigate } = useListTransition();

  const setFilter = React.useCallback(
    (key: FilterKey, value: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "activity");
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      navigate(params);
    },
    [navigate],
  );

  const clearFilter = React.useCallback(
    (key: FilterKey) => {
      setFilter(key, "");
    },
    [setFilter],
  );

  const clearAllFilters = React.useCallback(() => {
    const params = new URLSearchParams();
    params.set("tab", "activity");
    const batch = new URLSearchParams(window.location.search).get("batch");
    if (batch) {
      params.set("batch", batch);
    }
    navigate(params);
  }, [navigate]);

  const filterWarehouse = filters.warehouseId
    ? filterOptions.warehouses.find((w) => w.id === filters.warehouseId)
    : null;

  const chipSpecs: FilterChipSpec[] = compactChipSpecs([
    filters.series && {
      key: "series",
      tone: "info",
      label: `Series: ${getSeriesDisplayName(filters.series as SerialSeries)}`,
      onClear: () => clearFilter("series"),
    },
    filters.type && {
      key: "type",
      tone: "accent",
      label: `Type: ${filters.type}`,
      onClear: () => clearFilter("type"),
    },
    filterWarehouse && {
      key: "warehouseId",
      tone: "neutral",
      label: `Warehouse: ${filterWarehouse.name}`,
      onClear: () => clearFilter("warehouseId"),
    },
    filters.dateFrom && {
      key: "dateFrom",
      tone: "neutral",
      label: `From ${formatDateTimeMedium(filters.dateFrom)}`,
      onClear: () => clearFilter("dateFrom"),
    },
    filters.dateTo && {
      key: "dateTo",
      tone: "neutral",
      label: `To ${formatDateTimeMedium(filters.dateTo)}`,
      onClear: () => clearFilter("dateTo"),
    },
  ]);

  return (
    <FilterBar
      activeChips={
        chipSpecs.length > 0 ? (
          <FilterChipsRow chips={chipSpecs} onClearAll={clearAllFilters} />
        ) : undefined
      }
    >
      <FilterSelect
        name="series"
        defaultValue={filters.series}
        onValueChange={(v) => setFilter("series", v)}
        placeholder="All series"
        ariaLabel="Series"
        triggerClassName="w-[160px]"
        options={Object.values(SerialSeries).map((s) => ({
          value: s,
          label: getSeriesDisplayName(s),
        }))}
      />
      <FilterSelect
        name="type"
        defaultValue={filters.type}
        onValueChange={(v) => setFilter("type", v)}
        placeholder="All types"
        ariaLabel="Type"
        triggerClassName="w-[160px]"
        options={[
          { value: "Receipt", label: "Receipt (PO / GRN)" },
          { value: "Print", label: "Print (internal)" },
        ]}
      />
      <FilterSelect
        name="warehouseId"
        defaultValue={filters.warehouseId}
        onValueChange={(v) => setFilter("warehouseId", v)}
        placeholder="All warehouses"
        ariaLabel="Warehouse"
        triggerClassName="w-[160px]"
        searchable
        options={filterOptions.warehouses.map((w) => ({
          value: w.id,
          label: w.name,
        }))}
      />
      <DateRangeFilter
        defaultFrom={filters.dateFrom}
        defaultTo={filters.dateTo}
        onFromChange={(v) => setFilter("dateFrom", v)}
        onToChange={(v) => setFilter("dateTo", v)}
      />
      {isPending ? (
        <span className="text-ds-xs text-muted-foreground">Updating…</span>
      ) : null}
    </FilterBar>
  );
}
