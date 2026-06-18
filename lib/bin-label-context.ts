import type { BinPrintRow } from "@/lib/bin-label-types";
import type { LabelBindingContext } from "@/lib/label-template-types";

export function binRowToBindingContext(
  row: BinPrintRow,
  warehouseName: string,
): LabelBindingContext {
  return {
    serial: "",
    seriesName: "",
    binCode: row.binCode,
    warehouseName,
    zone: row.zone,
    aisle: row.aisle,
    shelf: row.shelf,
  };
}

export function binRowsToBindingContexts(
  rows: BinPrintRow[],
  warehouseName: string,
): LabelBindingContext[] {
  return rows.map((row) => binRowToBindingContext(row, warehouseName));
}
