"use client";

import * as React from "react";

import type { SerialActivityRow } from "@/lib/serial-governance-types";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { ProcurementRefLink } from "@/components/shared/ProcurementRef";
import { formatSerialBatchLabel } from "@/lib/display-ref";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import { useListTransition } from "@/lib/list-transition-context";
import type { Paginated } from "@/lib/pagination";
import { getSeriesDisplayName } from "@/lib/serial-series";
import { cn } from "@/lib/utils";

const columns: DataTableColumn<SerialActivityRow>[] = [
  {
    id: "batch",
    header: "Batch",
    cell: (r) =>
      formatSerialBatchLabel({
        seriesName: getSeriesDisplayName(r.series),
        rangeStart: r.rangeStart,
        rangeEnd: r.rangeEnd,
        quantity: r.quantity,
      }),
  },
  { id: "series", header: "Series", cell: (r) => getSeriesDisplayName(r.series) },
  {
    id: "range",
    header: "Range",
    variant: "numeric",
    cell: (r) => (
      <span className="font-mono text-ds-xs">
        {r.rangeStart} → {r.rangeEnd}
      </span>
    ),
  },
  { id: "qty", header: "Qty", variant: "numeric", cell: (r) => r.quantity },
  { id: "type", header: "Type", cell: (r) => r.type },
  { id: "warehouse", header: "Warehouse", cell: (r) => r.warehouseName },
  {
    id: "link",
    header: "Linked PR / PO",
    cell: (r) =>
      r.linkedPrId ? (
        <ProcurementRefLink id={r.linkedPrId} />
      ) : r.linkedPoId ? (
        <ProcurementRefLink id={r.linkedPoId} />
      ) : (
        "—"
      ),
  },
  { id: "by", header: "Created by", cell: (r) => r.createdByName },
  { id: "on", header: "Date", variant: "date", cell: (r) => formatDateTimeMedium(r.createdAt) },
];

export function SerialActivityTable({
  activity,
  highlightBatchId,
  filters,
}: {
  activity: Paginated<SerialActivityRow>;
  highlightBatchId: string;
  filters: {
    series: string;
    type: string;
    warehouseId: string;
    dateFrom: string;
    dateTo: string;
  };
}) {
  const { navigate } = useListTransition();

  React.useEffect(() => {
    if (!highlightBatchId) {
      return;
    }
    const row = document.querySelector(`[data-row-key="${highlightBatchId}"]`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightBatchId, activity.items]);

  const handlePageChange = React.useCallback(
    (page: number) => {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "activity");
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      navigate(params, page > 1 ? { exactCount: true } : undefined);
    },
    [navigate],
  );

  const getRowKey = React.useCallback((row: SerialActivityRow) => row.id, []);
  const getRowClassName = React.useCallback(
    (row: SerialActivityRow) =>
      cn(
        row.id === highlightBatchId &&
          "bg-[var(--status-info-bg)]/40 ring-1 ring-inset ring-[var(--status-info)]/30",
      ),
    [highlightBatchId],
  );

  if (activity.items.length === 0) {
    return (
      <EmptyState title="No activity" description="No serial reservations match these filters." />
    );
  }

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={activity.items}
        getRowKey={getRowKey}
        getRowClassName={getRowClassName}
      />
      <Pagination
        basePath="/serial-governance"
        page={activity.page}
        pageSize={activity.pageSize}
        total={activity.total}
        totalPages={activity.totalPages}
        hasNextPage={activity.hasNextPage}
        onPageChange={handlePageChange}
        searchParams={{
          tab: "activity",
          series: filters.series || undefined,
          type: filters.type || undefined,
          warehouseId: filters.warehouseId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          batch: highlightBatchId || undefined,
        }}
      />
    </div>
  );
}
