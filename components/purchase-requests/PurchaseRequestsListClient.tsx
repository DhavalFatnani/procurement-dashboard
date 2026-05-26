"use client";

import { PRStatus, Role } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import type {
  CategoryOption,
  SubcategoryOption,
  UserOption,
  WarehouseOption,
} from "@/app/actions/purchase-requests";
import {
  PurchaseRequestsFilters,
  type PurchaseRequestsFiltersValue,
} from "@/components/purchase-requests/PurchaseRequestsFilters";
import { ListTransitionProvider } from "@/lib/list-transition-context";

type FilterScalarKey =
  | "categoryId"
  | "subcategoryId"
  | "executionType"
  | "warehouseId"
  | "createdById"
  | "dateFrom"
  | "dateTo";

/**
 * Owns navigation + transition state for the Purchase Requests list. The
 * persistent filter bar is rendered inline; the table (server-async, behind a
 * Suspense boundary) arrives as `children` so it can unmount on filter change
 * without taking the filter UI down with it.
 */
export function PurchaseRequestsListClient({
  role,
  filters,
  filterOptions,
  children,
}: {
  role: Role;
  filters: PurchaseRequestsFiltersValue;
  filterOptions: {
    categories: CategoryOption[];
    subcategories: SubcategoryOption[];
    warehouses: WarehouseOption[];
    creators: UserOption[];
  };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const navigate = React.useCallback(
    (params: URLSearchParams, options?: { exactCount?: boolean }) => {
      if (options?.exactCount) {
        params.set("exactCount", "1");
      } else {
        params.delete("exactCount");
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/purchase-requests?${qs}` : "/purchase-requests", {
          scroll: false,
        });
      });
    },
    [router],
  );

  const setFilter = React.useCallback(
    (key: FilterScalarKey, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Resetting filters returns the user to page 1.
      params.delete("page");
      // When category changes, clear dependent subcategory.
      if (key === "categoryId") {
        params.delete("subcategoryId");
      }
      navigate(params);
    },
    [navigate, searchParams],
  );

  const setStatusFilters = React.useCallback(
    (statuses: PRStatus[]) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("status");
      for (const s of statuses) {
        params.append("status", s);
      }
      params.delete("page");
      navigate(params);
    },
    [navigate, searchParams],
  );

  const clearFilter = React.useCallback(
    (key: FilterScalarKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      if (key === "categoryId") {
        params.delete("subcategoryId");
      }
      params.delete("page");
      navigate(params);
    },
    [navigate, searchParams],
  );

  const clearStatus = React.useCallback(
    (status: PRStatus) => {
      const remaining = filters.statuses.filter((s) => s !== status);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("status");
      for (const s of remaining) {
        params.append("status", s);
      }
      params.delete("page");
      navigate(params);
    },
    [navigate, searchParams, filters.statuses],
  );

  const clearAllFilters = React.useCallback(() => {
    navigate(new URLSearchParams());
  }, [navigate]);

  return (
    <ListTransitionProvider isPending={isPending} navigate={navigate}>
      <PurchaseRequestsFilters
        role={role}
        filters={filters}
        filterOptions={filterOptions}
        setFilter={setFilter}
        setStatusFilters={setStatusFilters}
        clearFilter={clearFilter}
        clearStatus={clearStatus}
        clearAllFilters={clearAllFilters}
      />
      {children}
    </ListTransitionProvider>
  );
}
