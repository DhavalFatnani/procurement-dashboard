export type BinPrintRow = {
  binCode: string;
  zone?: string;
  aisle?: string;
  shelf?: string;
};

export type BinLabelBindingInput = BinPrintRow & {
  warehouseName: string;
};

export type BinCsvParseResult = {
  rows: BinPrintRow[];
  errors: string[];
};

export const BIN_CSV_MAX_ROWS = 500;

export const BIN_CSV_SAMPLE_HEADERS = ["bin_code", "zone", "aisle", "shelf"] as const;
