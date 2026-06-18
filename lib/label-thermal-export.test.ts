import { describe, expect, it } from "vitest";

import { KNOT_REFERENCE_PRESET } from "@/lib/label-template-presets";
import { generateEpl, generateZpl } from "@/lib/label-thermal-export";

const context = {
  serial: "2000001050",
  seriesName: "Lock Tags",
  prId: "PR-test",
  reservationId: "res-test",
};

describe("label-thermal-export", () => {
  it("generates ZPL snapshot for reference preset", () => {
    const zpl = generateZpl(KNOT_REFERENCE_PRESET, context);
    expect(zpl).toMatchSnapshot();
    expect(zpl).toContain("^XA");
    expect(zpl).toContain("^XZ");
    expect(zpl).toContain("2000001050");
  });

  it("generates EPL snapshot for reference preset", () => {
    const epl = generateEpl(KNOT_REFERENCE_PRESET, context);
    expect(epl).toMatchSnapshot();
    expect(epl).toContain("2000001050");
  });
});
