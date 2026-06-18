import { describe, expect, it } from "vitest";

import { binRowToBindingContext, binRowsToBindingContexts } from "@/lib/bin-label-context";

describe("bin-label-context", () => {
  it("maps row and warehouse to binding context", () => {
    const ctx = binRowToBindingContext(
      { binCode: "A-12-03", zone: "Zone A", aisle: "12", shelf: "03" },
      "WH1 · Andheri",
    );
    expect(ctx.binCode).toBe("A-12-03");
    expect(ctx.warehouseName).toBe("WH1 · Andheri");
    expect(ctx.zone).toBe("Zone A");
    expect(ctx.serial).toBe("");
  });

  it("maps multiple rows", () => {
    const contexts = binRowsToBindingContexts(
      [{ binCode: "A-1" }, { binCode: "A-2" }],
      "WH1",
    );
    expect(contexts).toHaveLength(2);
    expect(contexts[1]?.binCode).toBe("A-2");
  });
});
