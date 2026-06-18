import { describe, expect, it } from "vitest";

import {
  loadLabelStudioDraft,
  markLabelStudioCustomized,
  saveLabelStudioDraft,
  clearLabelStudioDraft,
} from "@/lib/label-studio-draft";
import { getBinReferencePreset, getReferencePreset } from "@/lib/label-template-presets";
import {
  clampWizardStep,
  buildLabelStudioUrl,
  parseLabelStudioSearchParams,
  isEditorParams,
} from "@/lib/label-studio-url";
import { validateWizardStep } from "@/lib/label-studio-wizard";
import { dragFreeformElement, nudgeRect, resizeRect } from "@/lib/label-studio-canvas-math";
import { resolveFieldBinding, defaultLabelBindingContext } from "@/lib/label-template-types";

describe("label-studio-draft", () => {
  it("round-trips series draft through session storage", () => {
    const template = getReferencePreset();
    saveLabelStudioDraft({
      scope: { kind: "series", series: "LOCK_TAGS" },
      template,
      returnTo: "/purchase-requests/new?printOpen=1",
      customized: true,
      updatedAt: new Date().toISOString(),
    });
    const loaded = loadLabelStudioDraft({ kind: "series", series: "LOCK_TAGS" });
    expect(loaded?.customized).toBe(true);
    expect(loaded?.template.page.widthMm).toBe(template.page.widthMm);
    clearLabelStudioDraft({ kind: "series", series: "LOCK_TAGS" });
    expect(loadLabelStudioDraft({ kind: "series", series: "LOCK_TAGS" })).toBeNull();
  });

  it("round-trips bin template draft by template id", () => {
    const template = getBinReferencePreset();
    saveLabelStudioDraft({
      scope: { kind: "template", templateId: "tpl-1", purpose: "bin" },
      template,
      customized: true,
      updatedAt: new Date().toISOString(),
    });
    const loaded = loadLabelStudioDraft({ kind: "template", templateId: "tpl-1", purpose: "bin" });
    expect(loaded?.customized).toBe(true);
    clearLabelStudioDraft({ kind: "template", templateId: "tpl-1", purpose: "bin" });
  });

  it("markLabelStudioCustomized sets customized flag", () => {
    const draft = markLabelStudioCustomized(
      { kind: "series", series: "LOCK_TAGS" },
      getReferencePreset(),
      "/test",
    );
    expect(draft.customized).toBe(true);
    clearLabelStudioDraft({ kind: "series", series: "LOCK_TAGS" });
  });
});

describe("label-studio-url", () => {
  it("builds and parses serial editor URL", () => {
    const url = buildLabelStudioUrl({
      view: "editor",
      purpose: "serial",
      series: "LOCK_TAGS",
      returnTo: "/purchase-requests/new?printOpen=1",
      mode: "wizard",
      step: 2,
    });
    const params = parseLabelStudioSearchParams(new URL(url, "http://localhost").searchParams);
    expect(params.series).toBe("LOCK_TAGS");
    expect(params.purpose).toBe("serial");
    expect(params.mode).toBe("wizard");
    expect(params.step).toBe(2);
    expect(isEditorParams(params)).toBe(true);
  });

  it("parses hub URL without params", () => {
    const params = parseLabelStudioSearchParams(new URLSearchParams());
    expect(params.view).toBe("hub");
    expect(isEditorParams(params)).toBe(false);
  });

  it("parses library URL for bin templates", () => {
    const url = buildLabelStudioUrl({ view: "library", purpose: "bin" });
    const params = parseLabelStudioSearchParams(new URL(url, "http://localhost").searchParams);
    expect(params.view).toBe("library");
    expect(params.purpose).toBe("bin");
  });

  it("clamps wizard steps", () => {
    expect(clampWizardStep(0)).toBe(1);
    expect(clampWizardStep(99)).toBe(5);
  });
});

describe("label-studio-wizard", () => {
  it("requires content on step 3", () => {
    const empty = getReferencePreset();
    empty.cells = [];
    expect(validateWizardStep(3, empty).valid).toBe(false);
    expect(validateWizardStep(3, getReferencePreset()).valid).toBe(true);
  });
});

describe("label-template-types bin bindings", () => {
  it("resolves bin field bindings", () => {
    const ctx = defaultLabelBindingContext("bin");
    expect(resolveFieldBinding({ kind: "binCode" }, ctx)).toBe("A-12-03");
    expect(resolveFieldBinding({ kind: "warehouseName" }, ctx)).toBe("WH1 · Andheri");
    expect(
      resolveFieldBinding({ kind: "template", value: "Bin {{binCode}} / {{zone}}" }, ctx),
    ).toBe("Bin A-12-03 / Zone A");
  });
});

describe("label-studio-utils", () => {
  it("includes imperial and metric label stock sizes", async () => {
    const { LABEL_SIZE_OPTIONS } = await import("@/lib/label-studio-utils");
    const ids = LABEL_SIZE_OPTIONS.map((o) => o.id);
    expect(ids).toContain("label-3x1");
    expect(ids).toContain("label-2x1");
    expect(ids).toContain("label-4x6");
    expect(ids).toContain("label-58x40");
    expect(LABEL_SIZE_OPTIONS.filter((o) => o.group === "label").length).toBeGreaterThanOrEqual(9);
  });

  it("removes grid cells", async () => {
    const { removeGridCell } = await import("@/lib/label-studio-utils");
    const template = getReferencePreset();
    const cellId = template.cells![0]!.id;
    const next = removeGridCell(template, cellId);
    expect(next.cells?.some((c) => c.id === cellId)).toBe(false);
  });
});

describe("label-template-presets", () => {
  it("ships multiple built-in starting layouts", async () => {
    const { BUILT_IN_LABEL_PRESETS, BIN_BUILT_IN_PRESETS } = await import(
      "@/lib/label-template-presets"
    );
    expect(BUILT_IN_LABEL_PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(BIN_BUILT_IN_PRESETS.length).toBeGreaterThanOrEqual(2);
    for (const preset of BUILT_IN_LABEL_PRESETS) {
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.template.version).toBe(1);
    }
  });
});

describe("label-studio-canvas-math", () => {
  it("nudges within bounds", () => {
    const next = nudgeRect(
      { xMm: 1, yMm: 1, widthMm: 10, heightMm: 5 },
      20,
      20,
      { widthMm: 50, heightMm: 30 },
    );
    expect(next.xMm).toBeLessThanOrEqual(40);
    expect(next.yMm).toBeLessThanOrEqual(25);
  });

  it("resizes from southeast handle", () => {
    const next = resizeRect(
      { xMm: 0, yMm: 0, widthMm: 10, heightMm: 10 },
      "se",
      5,
      3,
      { widthMm: 50, heightMm: 50 },
    );
    expect(next.widthMm).toBe(15);
    expect(next.heightMm).toBe(13);
  });

  it("drags freeform element", () => {
    const el = {
      id: "a",
      xMm: 2,
      yMm: 2,
      widthMm: 10,
      heightMm: 8,
      zIndex: 1,
      element: { type: "spacer" as const },
    };
    const page = { widthMm: 58, heightMm: 40, marginMm: 2 };
    const moved = dragFreeformElement(el, 1, 1, page);
    expect(moved.xMm).toBe(3);
    expect(moved.yMm).toBe(3);
  });
});
