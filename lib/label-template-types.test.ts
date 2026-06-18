import { describe, expect, it } from "vitest";

import { KNOT_REFERENCE_PRESET, getReferencePreset } from "@/lib/label-template-presets";
import {
  createDefaultFieldBinding,
  parseLabelTemplate,
  resolveFieldBinding,
} from "@/lib/label-template-types";

describe("label-template-types", () => {
  it("parses reference preset intact", () => {
    const parsed = parseLabelTemplate(KNOT_REFERENCE_PRESET);
    expect(parsed).not.toBeNull();
    expect(parsed?.layoutMode).toBe("grid");
    expect(parsed?.cells?.length).toBe(4);
    expect(parsed?.page.widthMm).toBe(58);
  });

  it("rejects invalid version", () => {
    expect(parseLabelTemplate({ version: 2 })).toBeNull();
  });

  it("resolves field bindings", () => {
    expect(
      resolveFieldBinding({ kind: "serial" }, { serial: "100", seriesName: "Tags" }),
    ).toBe("100");
    expect(
      resolveFieldBinding(
        { kind: "template", value: "https://knot.in/t/{{serial}}" },
        { serial: "200", seriesName: "Tags" },
      ),
    ).toBe("https://knot.in/t/200");
  });

  it("creates default bindings", () => {
    expect(createDefaultFieldBinding("static")).toEqual({ kind: "static", value: "Text" });
    expect(createDefaultFieldBinding("serial")).toEqual({ kind: "serial" });
  });

  it("reference preset clone is independent", () => {
    const a = getReferencePreset();
    const b = getReferencePreset();
    a.page.widthMm = 99;
    expect(b.page.widthMm).toBe(58);
  });

  it("defaults text color to black when omitted", () => {
    const parsed = parseLabelTemplate(KNOT_REFERENCE_PRESET);
    const brandCell = parsed?.cells?.find((cell) => cell.id === "cell-brand");
    const serialCell = parsed?.cells?.find((cell) => cell.id === "cell-serial");
    expect(brandCell?.element.type).toBe("text");
    if (brandCell?.element.type === "text") {
      expect(brandCell.element.style.color).toBe("#000000");
    }
    if (serialCell?.element.type === "text") {
      expect(serialCell.element.style.color).toBe("#000000");
    }
  });
});
