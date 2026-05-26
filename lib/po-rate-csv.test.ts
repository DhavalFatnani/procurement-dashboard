import { describe, expect, it } from "vitest";

import {
  buildPORateCsv,
  parsePORateCsv,
  validatePORateCsvAgainstPR,
} from "@/lib/po-rate-csv";

describe("po-rate-csv", () => {
  const prId = "PR-test-001";
  const itemId = "prli-test-001";

  it("round-trips export and parse", () => {
    const csv = buildPORateCsv([
      {
        prLineItemId: itemId,
        prId,
        lineNumber: 1,
        lineItemNumber: 1,
        category: "Packaging",
        subcategory: "Zip lock",
        itemName: "Zip bag",
        sku: "SKU-1",
        unit: "pcs",
        quantity: 10,
        unitPriceInr: "",
      },
    ]);

    const parsed = parsePORateCsv(csv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.prLineItemId).toBe(itemId);
    expect(parsed.rows[0]!.quantity).toBe(10);
  });

  it("rejects changed quantities", () => {
    const parsed = parsePORateCsv(
      buildPORateCsv([
        {
          prLineItemId: itemId,
          prId,
          lineNumber: 1,
          lineItemNumber: 1,
          category: "Packaging",
          subcategory: "Zip lock",
          itemName: "Zip bag",
          sku: "",
          unit: "pcs",
          quantity: 99,
          unitPriceInr: "12.5",
        },
      ]),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const validated = validatePORateCsvAgainstPR(parsed.rows, {
      prId,
      items: [{ id: itemId, quantity: 10 }],
    });
    expect(validated.ok).toBe(false);
    if (validated.ok) {
      return;
    }
    expect(validated.message).toMatch(/Quantity mismatch/i);
  });

  it("accepts valid rates", () => {
    const parsed = parsePORateCsv(
      buildPORateCsv([
        {
          prLineItemId: itemId,
          prId,
          lineNumber: 1,
          lineItemNumber: 1,
          category: "Packaging",
          subcategory: "Zip lock",
          itemName: "Zip bag",
          sku: "",
          unit: "pcs",
          quantity: 10,
          unitPriceInr: "25",
        },
      ]),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const validated = validatePORateCsvAgainstPR(parsed.rows, {
      prId,
      items: [{ id: itemId, quantity: 10 }],
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      return;
    }
    expect(validated.itemPrices[0]).toEqual({
      prLineItemId: itemId,
      unitPrice: 25,
      quantity: 10,
    });
  });
});
