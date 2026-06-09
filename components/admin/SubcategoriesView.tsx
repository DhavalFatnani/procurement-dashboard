"use client";

import { ExecutionType, TaxonomyStatus } from "@/lib/prisma-enums";
import { Layers, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import {
  SubcategoryFormDrawer,
  type SeriesOption,
} from "@/components/admin/SubcategoryFormDrawer";
import {
  SubcategoryRowActions,
  type SubcategoryResolveOutcome,
} from "@/components/admin/SubcategoryRowActions";
import { Chip } from "@/components/shared/Chip";
import {
  DataTable,
  getRowId,
  type DataTableColumn,
} from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterSearch } from "@/components/shared/FilterSearch";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import type {
  SubcategoryListRow,
  TaxonomyCategoryOption,
} from "@/lib/queries/taxonomy";
import type { Paginated } from "@/lib/pagination";

const EXEC_LABEL: Record<ExecutionType, string> = {
  [ExecutionType.VENDOR_PURCHASE]: "Vendor",
  [ExecutionType.INTERNAL_PRINT]: "Internal print",
};

export function SubcategoriesView({
  initialRows,
  filters,
  categories,
  seriesOptions,
}: {
  initialRows: Paginated<SubcategoryListRow>;
  filters: { search: string; status: string; categoryId: string };
  categories: TaxonomyCategoryOption[];
  seriesOptions: SeriesOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = React.useState(initialRows);
  const [drawerMode, setDrawerMode] = React.useState<
    { kind: "create" } | { kind: "edit"; subcategory: SubcategoryListRow } | null
  >(null);

  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    router.replace(qs ? `/admin/taxonomy?${qs}` : "/admin/taxonomy", { scroll: false });
  }

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "subcategories");
    params.delete("page");
    for (const key of ["q", "status", "categoryId"]) {
      const v = String(fd.get(key) ?? "").trim();
      if (v) params.set(key, v);
      else params.delete(key);
    }
    navigate(params);
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    if (page > 1) params.set("exactCount", "1");
    navigate(params);
  }

  function handleResolved(id: string, outcome: SubcategoryResolveOutcome) {
    setRows((prev) => {
      if (outcome === "deleted") {
        return {
          ...prev,
          items: prev.items.filter((r) => r.id !== id),
          total: prev.total != null ? Math.max(0, prev.total - 1) : prev.total,
        };
      }
      const nextStatus =
        outcome === "deactivated" ? TaxonomyStatus.INACTIVE : TaxonomyStatus.ACTIVE;
      return {
        ...prev,
        items: prev.items.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)),
      };
    });
    router.refresh();
  }

  const columns: DataTableColumn<SubcategoryListRow>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Subcategory",
        cell: (r) => <span className="font-medium text-foreground">{r.name}</span>,
      },
      {
        id: "category",
        header: "Category",
        cell: (r) => r.categoryName,
      },
      {
        id: "execution",
        header: "Execution",
        cell: (r) => (
          <Chip tone={r.executionType === ExecutionType.INTERNAL_PRINT ? "info" : "neutral"} size="sm">
            {EXEC_LABEL[r.executionType]}
          </Chip>
        ),
      },
      {
        id: "series",
        header: "Series",
        cell: (r) => r.seriesLabel ?? "—",
      },
      {
        id: "items",
        header: "Catalog items",
        variant: "numeric",
        cell: (r) => String(r.catalogItemCount),
      },
      {
        id: "status",
        header: "Status",
        cell: (r) => (
          <Chip tone={r.status === TaxonomyStatus.ACTIVE ? "success" : "neutral"} size="sm">
            {r.status === TaxonomyStatus.ACTIVE ? "Active" : "Inactive"}
          </Chip>
        ),
      },
      {
        id: "actions",
        header: "",
        revealOnHover: true,
        cell: (r) => (
          <SubcategoryRowActions
            row={r}
            onEdit={() => setDrawerMode({ kind: "edit", subcategory: r })}
            onResolved={handleResolved}
          />
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setDrawerMode({ kind: "create" })}
          disabled={categories.filter((c) => c.status === TaxonomyStatus.ACTIVE).length === 0}
        >
          <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
          Add subcategory
        </Button>
      </div>

      <form onSubmit={handleFilterSubmit}>
        <FilterBar resultCount={rows.total ?? undefined}>
          <FilterSearch
            name="q"
            defaultValue={filters.search}
            placeholder="Search subcategories"
            ariaLabel="Search subcategories"
            width="w-[220px]"
          />
          <FilterSelect
            name="categoryId"
            defaultValue={filters.categoryId}
            placeholder="All categories"
            ariaLabel="Category"
            triggerClassName="w-[180px]"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <FilterSelect
            name="status"
            defaultValue={filters.status}
            placeholder="All statuses"
            ariaLabel="Status"
            triggerClassName="w-[150px]"
            options={[
              { value: TaxonomyStatus.ACTIVE, label: "Active" },
              { value: TaxonomyStatus.INACTIVE, label: "Inactive" },
            ]}
          />
          <Button type="submit" size="sm" className="h-8">
            Apply
          </Button>
        </FilterBar>
      </form>

      {rows.items.length === 0 ? (
        <EmptyState
          title="No subcategories"
          description="Add subcategories under a category to drive PR execution and catalog structure."
          icon={Layers}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows.items}
            getRowKey={getRowId}
            onRowClick={(r) => setDrawerMode({ kind: "edit", subcategory: r })}
          />
          <Pagination
            basePath="/admin/taxonomy"
            page={rows.page}
            pageSize={rows.pageSize}
            total={rows.total}
            totalPages={rows.totalPages}
            hasNextPage={rows.hasNextPage}
            onPageChange={handlePageChange}
            searchParams={{
              tab: "subcategories",
              q: filters.search || undefined,
              status: filters.status || undefined,
              categoryId: filters.categoryId || undefined,
            }}
          />
        </>
      )}

      <SubcategoryFormDrawer
        open={drawerMode != null}
        onOpenChange={(open) => {
          if (!open) setDrawerMode(null);
        }}
        mode={drawerMode ?? { kind: "create" }}
        categories={categories}
        seriesOptions={seriesOptions}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
