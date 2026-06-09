"use client";

import { CategoryBillingGranularity, TaxonomyStatus } from "@/lib/prisma-enums";
import { FolderTree, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { CategoryFormDrawer } from "@/components/admin/CategoryFormDrawer";
import {
  CategoryRowActions,
  type CategoryResolveOutcome,
} from "@/components/admin/CategoryRowActions";
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
import type { CategoryListRow } from "@/lib/queries/taxonomy";
import type { Paginated } from "@/lib/pagination";

const GRANULARITY_LABEL: Record<CategoryBillingGranularity, string> = {
  [CategoryBillingGranularity.CATALOG_ITEM]: "Catalog items",
  [CategoryBillingGranularity.SUBCATEGORY]: "Subcategory qty",
};

export function CategoriesView({
  initialRows,
  filters,
}: {
  initialRows: Paginated<CategoryListRow>;
  filters: { search: string; status: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = React.useState(initialRows);
  const [drawerMode, setDrawerMode] = React.useState<
    { kind: "create" } | { kind: "edit"; category: CategoryListRow } | null
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
    params.set("tab", "categories");
    params.delete("page");
    const q = String(fd.get("q") ?? "").trim();
    const status = String(fd.get("status") ?? "").trim();
    if (q) params.set("q", q);
    else params.delete("q");
    if (status) params.set("status", status);
    else params.delete("status");
    navigate(params);
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    if (page > 1) params.set("exactCount", "1");
    navigate(params);
  }

  function handleResolved(id: string, outcome: CategoryResolveOutcome) {
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

  const columns: DataTableColumn<CategoryListRow>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Category",
        cell: (r) => <span className="font-medium text-foreground">{r.name}</span>,
      },
      {
        id: "granularity",
        header: "Billing",
        cell: (r) => GRANULARITY_LABEL[r.billingGranularity],
      },
      {
        id: "subs",
        header: "Subcategories",
        variant: "numeric",
        cell: (r) => String(r.subcategoryCount),
      },
      {
        id: "usage",
        header: "PR lines",
        variant: "numeric",
        cell: (r) => String(r.prUsageCount),
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
          <CategoryRowActions
            row={r}
            onEdit={() => setDrawerMode({ kind: "edit", category: r })}
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
        <Button onClick={() => setDrawerMode({ kind: "create" })}>
          <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
          Add category
        </Button>
      </div>

      <form onSubmit={handleFilterSubmit}>
        <FilterBar resultCount={rows.total ?? undefined}>
          <FilterSearch
            name="q"
            defaultValue={filters.search}
            placeholder="Search categories"
            ariaLabel="Search categories"
            width="w-[220px]"
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
          title="No categories"
          description="Add a category to organize procurement subcategories and catalog items."
          icon={FolderTree}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows.items}
            getRowKey={getRowId}
            onRowClick={(r) => setDrawerMode({ kind: "edit", category: r })}
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
              tab: "categories",
              q: filters.search || undefined,
              status: filters.status || undefined,
            }}
          />
        </>
      )}

      <CategoryFormDrawer
        open={drawerMode != null}
        onOpenChange={(open) => {
          if (!open) setDrawerMode(null);
        }}
        mode={drawerMode ?? { kind: "create" }}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
