"use client";

import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** monospace secondary styling for IDs, ranges, amounts */
  variant?: "id" | "mono" | "numeric" | "date" | "default";
  /** fade in on row hover (e.g. actions column) */
  revealOnHover?: boolean;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  getRowKey?: (row: T, index: number) => string;
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

export function DataTable<T>({ columns, data, onRowClick, getRowKey }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border-subtle bg-background hover:bg-background">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={cn(
                  "h-9 px-3 text-ds-xs font-medium uppercase tracking-wide text-muted-foreground",
                  col.variant === "numeric" && "text-right",
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
              className={cn(
                "group/row h-10 border-border-subtle bg-card transition-table-row hover:bg-muted",
                onRowClick && "cursor-pointer",
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(
                    "px-3 py-0 align-middle",
                    cellClass(col.variant),
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
  );
}
