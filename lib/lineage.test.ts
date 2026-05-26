import { describe, expect, it } from "vitest";

import {
  invoiceDetailBreadcrumbs,
  poDetailBreadcrumbs,
  prDetailBreadcrumbs,
} from "@/lib/lineage";

describe("breadcrumb lineage", () => {
  it("renders PR detail as Purchase Requests › PR-…", () => {
    const items = prDetailBreadcrumbs("PR-abcdef0123");
    expect(items).toHaveLength(2);
    expect(items[0]!.label).toBe("Purchase Requests");
    expect(items[1]!.mono).toBe(true);
  });

  it("renders PO detail with optional PR link", () => {
    const items = poDetailBreadcrumbs({
      poId: "PO-1111111111",
      prId: "PR-2222222222",
    });
    expect(items.map((i) => i.label)).toEqual([
      "Purchase Orders",
      expect.stringContaining("PR-"),
      expect.stringContaining("PO-"),
    ]);
  });

  it("renders invoice detail with full lineage", () => {
    const items = invoiceDetailBreadcrumbs({
      invoiceNumber: "INV-2026-001",
      poId: "PO-aaaaaaaaaa",
      prId: "PR-bbbbbbbbbb",
    });
    expect(items.map((i) => i.label)).toEqual([
      "Invoices",
      expect.stringContaining("PR-"),
      expect.stringContaining("PO-"),
      "INV-INV-2026-001",
    ]);
  });
});
