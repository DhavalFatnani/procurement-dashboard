import { describe, expect, it } from "vitest";

import { KNOT_REFERENCE_PRESET } from "@/lib/label-template-presets";
import { defaultLabelBindingContext, resolveLabelBindings } from "@/lib/label-template-types";
import { renderLabelToDom } from "@/lib/label-template-render";

describe("label-template-render bindings", () => {
  it("resolves all cell bindings for reference preset", () => {
    const bindings = resolveLabelBindings(KNOT_REFERENCE_PRESET, {
      serial: "2000001050",
      seriesName: "Lock Tags",
      prId: "PR-abc",
      reservationId: "res-1",
    });

    expect(bindings.get("cell-brand")).toBe("KNOT");
    expect(bindings.get("cell-barcode")).toBe("2000001050");
    expect(bindings.get("cell-serial")).toBe("2000001050");
    expect(bindings.get("cell-qr")).toBe("https://knot.in/t/2000001050");
  });

  it("renders barcode placeholder when serial value is empty", async () => {
    const root = document.createElement("div");
    const template = structuredClone(KNOT_REFERENCE_PRESET);
    await renderLabelToDom(template, defaultLabelBindingContext("bin"), root);

    const barcodeCell = root.querySelector(".label-el-barcode");
    expect(barcodeCell?.textContent).toBe("Barcode");
    expect(root.querySelector(".label-el-barcode svg")).toBeNull();
  });
});
