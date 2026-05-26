"use client";

import { memo, type ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Stable row-key accessor for the common `id` case — module-level so its
 * reference never changes, keeping the memoized DataTable from re-rendering. */
export const getRowId = <T extends { id: string }>(row: T): string => row.id;

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** monospace secondary styling for IDs, ranges, amounts */
  variant?: "id" | "mono" | "numeric" | "date" | "default";
  /** fade in on row hover (e.g. actions column) */
  revealOnHover?: boolean;
  /** stick this column to the left on horizontal scroll */
  sticky?: boolean;
};

export type DataTableDensity = "compact" | "cozy";

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  getRowKey?: (row: T, index: number) => string;
  getRowClassName?: (row: T, index: number) => string | undefined;
  density?: DataTableDensity;
};

function cellClass(variant: DataTableColumn<unknown>["variant"]) {
  switch (variant) {
    case "id":
    case "mono":
      return "font-mono text-ds-xs text-muted-foreground";
    case "numeric":
      return "font-tabular text-ds-sm text-right";
    case "date":
      return "text-ds-xs text-muted-foreground";
    default:
      return "text-ds-sm";
  }
}

function DataTableInner<T>({
  columns,
  data,
  onRowClick,
  getRowKey,
  getRowClassName,
  density = "compact",
}: DataTableProps<T>) {
  const rowHeight = density === "cozy" ? "h-12" : "h-10";

  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-card shadow-ds">
      <div className="max-h-[70vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="border-border-subtle bg-muted/50 hover:bg-muted/50">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={cn(
                  "h-9 px-3 text-ds-2xs font-semibold uppercase tracking-wider text-muted-foreground",
                  col.variant === "numeric" && "text-right",
                  col.sticky && "sticky left-0 bg-muted/50",
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow
              key={getRowKey ? getRowKey(row, rowIndex) : String(rowIndex)}
              data-row-key={getRowKey ? getRowKey(row, rowIndex) : String(rowIndex)}
              className={cn(
                "group/row border-border-subtle bg-card",
                "transition-[background,box-shadow] duration-fast",
                "hover:bg-muted/50 hover:shadow-[inset_3px_0_0_0_var(--brand-accent)]",
                rowHeight,
                onRowClick && "cursor-pointer",
                getRowClassName?.(row, rowIndex),
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(
                    "px-3 py-0 align-middle",
                    cellClass(col.variant),
                    col.sticky && "sticky left-0 bg-card group-hover/row:bg-muted/50",
                    col.revealOnHover &&
                      "opacity-0 transition-row-actions group-hover/row:opacity-100",
                  )}
                  onClick={
                    col.revealOnHover
                      ? (e) => {
                          e.stopPropagation();
                        }
                      : undefined
                  }
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Memoized so rows don't re-render when the parent re-renders with unchanged
 * props. Callers must pass referentially stable `columns`, `data`, `getRowKey`,
 * and `onRowClick` (see `getRowId` and useMemo/useCallback at call sites). */
export const DataTable = memo(DataTableInner) as typeof DataTableInner;
