import type { BinCsvParseResult, BinPrintRow } from "@/lib/bin-label-types";
import { BIN_CSV_MAX_ROWS } from "@/lib/bin-label-types";

const BIN_CODE_HEADERS = new Set(["bin_code", "bin", "code", "bincode", "location"]);
const ZONE_HEADERS = new Set(["zone"]);
const AISLE_HEADERS = new Set(["aisle"]);
const SHELF_HEADERS = new Set(["shelf"]);

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function parseCsvRows(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

function detectHeaderMap(headers: string[]): Map<string, number> | null {
  const normalized = headers.map(normalizeHeader);
  const hasBin = normalized.some((h) => BIN_CODE_HEADERS.has(h));
  if (!hasBin) {
    return null;
  }

  const map = new Map<string, number>();
  normalized.forEach((header, index) => {
    if (BIN_CODE_HEADERS.has(header)) map.set("binCode", index);
    if (ZONE_HEADERS.has(header)) map.set("zone", index);
    if (AISLE_HEADERS.has(header)) map.set("aisle", index);
    if (SHELF_HEADERS.has(header)) map.set("shelf", index);
  });

  return map.has("binCode") ? map : null;
}

function rowFromCells(cells: string[], headerMap: Map<string, number> | null): BinPrintRow | null {
  const get = (key: string) => {
    if (!headerMap) return undefined;
    const index = headerMap.get(key);
    if (index === undefined) return undefined;
    const value = cells[index]?.trim();
    return value || undefined;
  };

  const binCode = headerMap ? (cells[headerMap.get("binCode")!]?.trim() ?? "") : (cells[0]?.trim() ?? "");

  if (!binCode) {
    return null;
  }

  return {
    binCode,
    zone: get("zone"),
    aisle: get("aisle"),
    shelf: get("shelf"),
  };
}

/** Parse bin label CSV — single column or header row with bin_code, zone, aisle, shelf. */
export function parseBinLabelCsv(text: string): BinCsvParseResult {
  const errors: string[] = [];
  const parsed = parseCsvRows(text);

  if (parsed.length === 0) {
    return { rows: [], errors: ["CSV is empty."] };
  }

  const firstRow = parsed[0]!;
  const headerMap = detectHeaderMap(firstRow);
  const dataRows = headerMap ? parsed.slice(1) : parsed;

  if (dataRows.length === 0) {
    return { rows: [], errors: ["No data rows found after header."] };
  }

  if (dataRows.length > BIN_CSV_MAX_ROWS) {
    errors.push(`Too many rows (${dataRows.length}). Maximum is ${BIN_CSV_MAX_ROWS}.`);
    return { rows: [], errors };
  }

  const rows: BinPrintRow[] = [];
  const seen = new Set<string>();

  dataRows.forEach((cells, index) => {
    const lineNum = headerMap ? index + 2 : index + 1;
    const row = rowFromCells(cells, headerMap);
    if (!row) {
      errors.push(`Line ${lineNum}: missing bin code.`);
      return;
    }
    const key = row.binCode.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Line ${lineNum}: duplicate bin code "${row.binCode}".`);
      return;
    }
    seen.add(key);
    rows.push(row);
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No valid bin codes found.");
  }

  return { rows, errors };
}

export function buildBinLabelCsvSample(): string {
  return ["bin_code,zone,aisle,shelf", "A-12-03,Zone A,12,03", "A-12-04,Zone A,12,04"].join("\n");
}
