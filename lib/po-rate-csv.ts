export const PO_RATE_CSV_HEADERS = [
  "pr_line_item_id",
  "pr_id",
  "line_number",
  "line_item_number",
  "category",
  "subcategory",
  "item_name",
  "sku",
  "unit",
  "quantity",
  "unit_price_inr",
] as const;

export type PORateCsvRow = {
  prLineItemId: string;
  prId: string;
  lineNumber: number;
  lineItemNumber: number;
  category: string;
  subcategory: string;
  itemName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPriceInr: string;
};

export type PORateCsvExportRow = Omit<PORateCsvRow, "unitPriceInr"> & {
  unitPriceInr: "";
};

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildPORateCsv(rows: PORateCsvExportRow[] | PORateCsvRow[]): string {
  const header = PO_RATE_CSV_HEADERS.join(",");
  const body = rows.map((row) =>
    [
      row.prLineItemId,
      row.prId,
      String(row.lineNumber),
      String(row.lineItemNumber),
      row.category,
      row.subcategory,
      row.itemName,
      row.sku,
      row.unit,
      String(row.quantity),
      row.unitPriceInr,
    ]
      .map(escapeCsvCell)
      .join(","),
  );
  return [header, ...body].join("\n");
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
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

export function parsePORateCsv(text: string): {
  ok: true;
  rows: PORateCsvRow[];
} | {
  ok: false;
  message: string;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, message: "CSV file is empty." };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, message: "CSV must include a header row and at least one data row." };
  }

  const headerCells = parseCsvLine(lines[0]!);
  const expected = [...PO_RATE_CSV_HEADERS];
  if (headerCells.length !== expected.length) {
    return {
      ok: false,
      message: `Expected ${expected.length} columns: ${expected.join(", ")}`,
    };
  }
  for (let i = 0; i < expected.length; i++) {
    if (headerCells[i] !== expected[i]) {
      return {
        ok: false,
        message: `Invalid header column ${i + 1}: expected "${expected[i]}", got "${headerCells[i]}".`,
      };
    }
  }

  const rows: PORateCsvRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const cells = parseCsvLine(lines[lineIndex]!);
    if (cells.length !== expected.length) {
      return {
        ok: false,
        message: `Row ${lineIndex + 1} has ${cells.length} columns; expected ${expected.length}.`,
      };
    }
    const quantity = Number(cells[9]);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, message: `Row ${lineIndex + 1}: invalid quantity.` };
    }
    rows.push({
      prLineItemId: cells[0]!,
      prId: cells[1]!,
      lineNumber: Number(cells[2]),
      lineItemNumber: Number(cells[3]),
      category: cells[4]!,
      subcategory: cells[5]!,
      itemName: cells[6]!,
      sku: cells[7]!,
      unit: cells[8]!,
      quantity,
      unitPriceInr: cells[10]!,
    });
  }

  return { ok: true, rows };
}

export type PORateCsvValidationRow = {
  prLineItemId: string;
  unitPrice: number;
  quantity: number;
};

export function validatePORateCsvAgainstPR(
  parsed: PORateCsvRow[],
  expected: {
    prId: string;
    items: { id: string; quantity: number }[];
  },
): { ok: true; itemPrices: PORateCsvValidationRow[] } | { ok: false; message: string } {
  if (parsed.length !== expected.items.length) {
    return {
      ok: false,
      message: `CSV has ${parsed.length} rows but this PR has ${expected.items.length} catalog items.`,
    };
  }

  const expectedById = new Map(expected.items.map((i) => [i.id, i]));
  const itemPrices: PORateCsvValidationRow[] = [];

  for (const row of parsed) {
    if (row.prId !== expected.prId) {
      return { ok: false, message: `Row for ${row.prLineItemId} references wrong PR id.` };
    }
    const match = expectedById.get(row.prLineItemId);
    if (!match) {
      return { ok: false, message: `Unknown pr_line_item_id: ${row.prLineItemId}` };
    }
    if (match.quantity !== row.quantity) {
      return {
        ok: false,
        message: `Quantity mismatch for ${row.itemName}. Do not change quantities in the CSV.`,
      };
    }
    const unitPrice = Number(row.unitPriceInr);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return {
        ok: false,
        message: `Invalid unit_price_inr for ${row.itemName}.`,
      };
    }
    itemPrices.push({
      prLineItemId: row.prLineItemId,
      unitPrice,
      quantity: row.quantity,
    });
  }

  for (const item of expected.items) {
    if (!itemPrices.some((p) => p.prLineItemId === item.id)) {
      return { ok: false, message: `Missing rate for catalog item ${item.id}.` };
    }
  }

  return { ok: true, itemPrices };
}
