"use client";

import { Download } from "lucide-react";
import { Role } from "@/lib/prisma-enums";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import type { PurchaseRequestListRow } from "@/lib/queries/purchase-requests";
import { PRListTable } from "@/components/purchase-requests/PRListTable";
import { Button } from "@/components/ui/button";
import { formatProcurementRef } from "@/lib/display-ref";
import { useListTransition } from "@/lib/list-transition-context";
import type { Paginated } from "@/lib/pagination";

export type PurchaseRequestsTableFilters = {
  categoryId: string;
  subcategoryId: string;
  executionType: string;
  warehouseId: string;
  createdById: string;
  dateFrom: string;
  dateTo: string;
};

export function PurchaseRequestsTable({
  role,
  rows,
  filters,
}: {
  role: Role;
  rows: Paginated<PurchaseRequestListRow>;
  filters: PurchaseRequestsTableFilters;
}) {
  const { isPending, navigate } = useListTransition();
  const searchParams = useSearchParams();

  const handlePageChange = React.useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      navigate(params, { exactCount: page > 1 });
    },
    [navigate, searchParams],
  );

  const handleRowsChange = React.useCallback(() => {
    navigate(new URLSearchParams(searchParams.toString()), {
      exactCount: searchParams.get("exactCount") === "1",
    });
  }, [navigate, searchParams]);

  const resultCount = rows.total ?? rows.items.length;

  const paginationSearchParams: Record<string, string | undefined> = {
    categoryId: filters.categoryId || undefined,
    subcategoryId: filters.subcategoryId || undefined,
    executionType: filters.executionType || undefined,
    warehouseId: filters.warehouseId || undefined,
    createdById: filters.createdById || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };

  function exportPrCsv() {
    const header = [
      "ref",
      "status",
      "category",
      "subcategory",
      "executionType",
      "createdAt",
    ];
    const lines = rows.items.map((r) =>
      [
        formatProcurementRef(r.id),
        r.status,
        r.categoryName,
        r.subcategoryName,
        r.executionType,
        r.createdAt,
      ]
        .map((c) => `"${String(c).replaceAll('"', '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "purchase-requests.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-ds-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{resultCount}</span>{" "}
            result{resultCount === 1 ? "" : "s"}
          </span>
          {isPending ? (
            <span
              className="inline-flex items-center gap-1.5 text-ds-xs text-muted-foreground"
              aria-live="polite"
            >
              <span
                className="inline-block size-1.5 animate-ds-pulse rounded-full bg-[var(--brand-accent)]"
                aria-hidden
              />
              Updating…
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="soft"
          size="sm"
          className="h-8 gap-1.5"
          onClick={exportPrCsv}
        >
          <Download className="size-3.5" strokeWidth={1.5} />
          Export CSV
        </Button>
      </div>

      <PRListTable
        role={role}
        rows={rows}
        isPending={isPending}
        paginationSearchParams={paginationSearchParams}
        onPageChange={handlePageChange}
        onRowsChange={handleRowsChange}
      />
    </div>
  );
}
