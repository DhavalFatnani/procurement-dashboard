"use client";

import { CatalogItemStatus } from "@/lib/prisma-enums";
import { Package, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { CatalogItemFormDrawer } from "@/components/admin/CatalogItemFormDrawer";
import {
  CatalogRowActions,
  type CatalogItemResolveOutcome,
} from "@/components/admin/CatalogRowActions";
import { Chip } from "@/components/shared/Chip";
import {
  DataTable,
  getRowId,
  type DataTableColumn,
} from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar } from "@/components/shared/FilterBar";
import { FilterChipsRow } from "@/components/shared/FilterChipsRow";
import { FilterSearch } from "@/components/shared/FilterSearch";
import { FilterSelect } from "@/components/shared/FilterSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { compactChipSpecs, type FilterChipSpec } from "@/lib/filter-chips";
import { formatDateMedium } from "@/lib/format-datetime";
import type {
  CatalogItemListRow,
  CatalogSubcategoryOption,
} from "@/lib/queries/catalog";
import type { Paginated } from "@/lib/pagination";

const STATUS_LABEL: Record<CatalogItemStatus, string> = {
  [CatalogItemStatus.PENDING_APPROVAL]: "Pending",
  [CatalogItemStatus.ACTIVE]: "Active",
  [CatalogItemStatus.REJECTED]: "Rejected",
  [CatalogItemStatus.INACTIVE]: "Inactive",
};

const STATUS_TONE: Record<
  CatalogItemStatus,
  "warning" | "success" | "error" | "neutral"
> = {
  [CatalogItemStatus.PENDING_APPROVAL]: "warning",
  [CatalogItemStatus.ACTIVE]: "success",
  [CatalogItemStatus.REJECTED]: "error",
  [CatalogItemStatus.INACTIVE]: "neutral",
};

const STATUS_OPTIONS = Object.values(CatalogItemStatus).map((value) => ({
  value,
  label: STATUS_LABEL[value],
}));

export function CatalogView({
  initialRows,
  filters,
  filterOptions,
  pendingCount,
}: {
  initialRows: Paginated<CatalogItemListRow>;
  filters: {
    search: string;
    status: string;
    categoryId: string;
    subcategoryId: string;
  };
  filterOptions: {
    categories: { id: string; name: string }[];
    subcategories: CatalogSubcategoryOption[];
  };
  pendingCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();
  const [pageRows, setPageRows] = React.useState(initialRows);
  const [localPendingCount, setLocalPendingCount] = React.useState(pendingCount);

  React.useEffect(() => {
    setPageRows(initialRows);
  }, [initialRows]);

  React.useEffect(() => {
    setLocalPendingCount(pendingCount);
  }, [pendingCount]);

  const handleItemResolved = React.useCallback(
    (id: string, outcome: CatalogItemResolveOutcome) => {
      const viewingPendingOnly = filters.status === CatalogItemStatus.PENDING_APPROVAL;

      setPageRows((prev) => {
        let items = prev.items;

        if (outcome === "approved") {
          items = items.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: CatalogItemStatus.ACTIVE,
                  approvedAt: new Date().toISOString(),
                }
              : r,
          );
          if (viewingPendingOnly) {
            items = items.filter((r) => r.id !== id);
          }
          setLocalPendingCount((c) => Math.max(0, c - 1));
        } else if (outcome === "rejected") {
          items = items.map((r) =>
            r.id === id ? { ...r, status: CatalogItemStatus.REJECTED } : r,
          );
          if (viewingPendingOnly) {
            items = items.filter((r) => r.id !== id);
          }
          setLocalPendingCount((c) => Math.max(0, c - 1));
        } else if (outcome === "deactivated") {
          items = items.map((r) =>
            r.id === id ? { ...r, status: CatalogItemStatus.INACTIVE } : r,
          );
        } else if (outcome === "reactivated") {
          items = items.map((r) =>
            r.id === id ? { ...r, status: CatalogItemStatus.ACTIVE } : r,
          );
        }

        return { ...prev, items };
      });

      startTransition(() => {
        router.refresh();
      });
    },
    [filters.status, router],
  );

  const [drawerMode, setDrawerMode] = React.useState<
    { kind: "create" } | { kind: "edit"; item: CatalogItemListRow } | null
  >(null);

  const subsForCategory = React.useMemo(() => {
    if (!filters.categoryId) {
      return filterOptions.subcategories;
    }
    return filterOptions.subcategories.filter(
      (s) => s.categoryId === filters.categoryId,
    );
  }, [filterOptions.subcategories, filters.categoryId]);

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    router.replace(qs ? `/admin/catalog?${qs}` : "/admin/catalog", { scroll: false });
  }

  function handleFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["q", "status", "categoryId", "subcategoryId"]) {
      const v = String(fd.get(key) ?? "").trim();
      if (v) params.set(key, v);
    }
    navigate(params);
  }

  function clearFilter(key: "q" | "status" | "categoryId" | "subcategoryId") {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    if (key === "categoryId") {
      params.delete("subcategoryId");
    }
    params.delete("page");
    navigate(params);
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    if (page > 1) params.set("exactCount", "1");
    navigate(params);
  }

  const category = filters.categoryId
    ? filterOptions.categories.find((c) => c.id === filters.categoryId)
    : null;
  const subcategory = filters.subcategoryId
    ? filterOptions.subcategories.find((s) => s.id === filters.subcategoryId)
    : null;

  const chipSpecs: FilterChipSpec[] = compactChipSpecs([
    filters.search && {
      key: "q",
      tone: "neutral",
      label: `Search: "${filters.search}"`,
      onClear: () => clearFilter("q"),
    },
    filters.status && {
      key: "status",
      tone: STATUS_TONE[filters.status as CatalogItemStatus] ?? "neutral",
      label: `Status: ${STATUS_LABEL[filters.status as CatalogItemStatus] ?? filters.status}`,
      onClear: () => clearFilter("status"),
    },
    category && {
      key: "categoryId",
      tone: "neutral",
      label: `Category: ${category.name}`,
      onClear: () => clearFilter("categoryId"),
    },
    subcategory && {
      key: "subcategoryId",
      tone: "neutral",
      label: `Subcategory: ${subcategory.name}`,
      onClear: () => clearFilter("subcategoryId"),
    },
  ]);

  const columns: DataTableColumn<CatalogItemListRow>[] = React.useMemo(
    () => [
      {
        id: "name",
        header: "Item",
        cell: (r) => (
          <div>
            <span className="font-medium text-foreground">{r.name}</span>
            {r.sku ? (
              <span className="block text-ds-xs text-muted-foreground">{r.sku}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: "taxonomy",
        header: "Category / subcategory",
        cell: (r) => (
          <span className="text-ds-sm">
            {r.categoryName}
            <span className="text-muted-foreground"> / {r.subcategoryName}</span>
          </span>
        ),
      },
      {
        id: "unit",
        header: "Unit",
        cell: (r) => r.unit,
      },
      {
        id: "status",
        header: "Status",
        cell: (r) => (
          <Chip tone={STATUS_TONE[r.status]} size="sm">
            {STATUS_LABEL[r.status]}
          </Chip>
        ),
      },
      {
        id: "usage",
        header: "PR uses",
        variant: "numeric",
        cell: (r) => String(r.usageCount),
      },
      {
        id: "created",
        header: "Created",
        variant: "date",
        cell: (r) => formatDateMedium(r.createdAt),
      },
      {
        id: "actions",
        header: "",
        revealOnHover: true,
        cell: (r) => (
          <CatalogRowActions
            row={r}
            onEdit={() => setDrawerMode({ kind: "edit", item: r })}
            onResolved={handleItemResolved}
          />
        ),
      },
    ],
    [handleItemResolved],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item catalog"
        subtitle={
          localPendingCount > 0
            ? `${localPendingCount} catalog item${localPendingCount === 1 ? "" : "s"} pending approval. Packaging, Lock Tags, and Last Mile bill at subcategory level on PRs.`
            : "Warehouse Maintenance and IT and Hardware Assets use the item catalog. Packaging, Lock Tags, and Last Mile use subcategory quantity on PRs."
        }
        action={
          <Button onClick={() => setDrawerMode({ kind: "create" })}>
            <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
            Add item
          </Button>
        }
      />

      <form onSubmit={handleFilterSubmit}>
        <FilterBar
          resultCount={pageRows.total ?? undefined}
          activeChips={
            chipSpecs.length > 0 ? (
              <FilterChipsRow
                chips={chipSpecs}
                onClearAll={() => navigate(new URLSearchParams())}
              />
            ) : undefined
          }
        >
          <FilterSearch
            name="q"
            defaultValue={filters.search}
            placeholder="Search name or SKU"
            ariaLabel="Search catalog"
            width="w-[220px]"
          />
          <FilterSelect
            name="status"
            defaultValue={filters.status}
            placeholder="All statuses"
            ariaLabel="Status"
            triggerClassName="w-[160px]"
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            name="categoryId"
            defaultValue={filters.categoryId}
            placeholder="All categories"
            ariaLabel="Category"
            triggerClassName="w-[180px]"
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
            triggerClassName="w-[220px]"
            options={subsForCategory.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.categoryName})`,
            }))}
          />
          <Button type="submit" size="sm" className="h-8">
            Apply
          </Button>
        </FilterBar>
      </form>

      {pageRows.items.length === 0 ? (
        <EmptyState
          title="No catalog items"
          description="Adjust filters or add an active item for store managers to use on vendor PRs."
          icon={Package}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageRows.items}
            getRowKey={getRowId}
            onRowClick={(r) => {
              if (
                r.status === CatalogItemStatus.ACTIVE ||
                r.status === CatalogItemStatus.INACTIVE
              ) {
                setDrawerMode({ kind: "edit", item: r });
              }
            }}
          />
          <Pagination
            basePath="/admin/catalog"
            page={pageRows.page}
            pageSize={pageRows.pageSize}
            total={pageRows.total}
            totalPages={pageRows.totalPages}
            hasNextPage={pageRows.hasNextPage}
            onPageChange={handlePageChange}
            searchParams={{
              q: filters.search || undefined,
              status: filters.status || undefined,
              categoryId: filters.categoryId || undefined,
              subcategoryId: filters.subcategoryId || undefined,
            }}
          />
        </>
      )}

      <CatalogItemFormDrawer
        open={drawerMode != null}
        onOpenChange={(open) => {
          if (!open) setDrawerMode(null);
        }}
        mode={drawerMode ?? { kind: "create" }}
        subcategories={filterOptions.subcategories}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
