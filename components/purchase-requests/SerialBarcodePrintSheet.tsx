"use client";

import * as React from "react";

import {
  applyBarcodeLabelConfigToRoot,
  type BarcodeLabelConfig,
  DEFAULT_BARCODE_LABEL_CONFIG,
  jsBarcodeOptionsFromConfig,
} from "@/lib/barcode-label-config";
import { listSerialNumbersInRange, serialPrintSessionKey } from "@/lib/serial-range";

const LABEL_BATCH_SIZE = 24;

export type SerialBarcodePrintSheetProps = {
  reservationId: string;
  rangeStart: string;
  rangeEnd: string;
  seriesName: string;
  labelConfig?: BarcodeLabelConfig;
  autoPrint: boolean;
  onStatusChange?: (status: "preparing" | "ready" | "printing" | "done") => void;
  onProgress?: (completed: number, total: number) => void;
};

type JsBarcodeFn = (
  element: SVGElement,
  value: string,
  options: ReturnType<typeof jsBarcodeOptionsFromConfig>,
) => void;

function createLabelElement(
  serial: string,
  seriesName: string,
  config: BarcodeLabelConfig,
  JsBarcode: JsBarcodeFn,
): HTMLElement {
  const article = document.createElement("article");
  article.className = "serial-label";

  const brand = document.createElement("p");
  brand.className = "serial-label-brand";
  brand.textContent = "KNOT";

  const barcodeWrap = document.createElement("div");
  barcodeWrap.className = "serial-label-barcode";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Barcode ${serial}`);
  JsBarcode(svg, serial, jsBarcodeOptionsFromConfig(config));
  barcodeWrap.appendChild(svg);

  if (config.showSeriesName) {
    const series = document.createElement("p");
    series.className = "serial-label-series";
    series.textContent = seriesName;
    article.append(brand, barcodeWrap, series);
  } else {
    article.append(brand, barcodeWrap);
  }

  return article;
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function renderLabelsInBatches(
  root: HTMLElement,
  serials: string[],
  seriesName: string,
  config: BarcodeLabelConfig,
  JsBarcode: JsBarcodeFn,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  applyBarcodeLabelConfigToRoot(root, config);
  root.replaceChildren();
  const grid = document.createElement("div");
  grid.className = "serial-label-grid";
  root.appendChild(grid);
  const total = serials.length;
  onProgress?.(0, total);

  for (let index = 0; index < serials.length; index += LABEL_BATCH_SIZE) {
    const batch = serials.slice(index, index + LABEL_BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    for (const serial of batch) {
      fragment.appendChild(createLabelElement(serial, seriesName, config, JsBarcode));
    }
    grid.appendChild(fragment);
    onProgress?.(Math.min(index + batch.length, total), total);
    await waitForNextFrame();
  }
}

export function SerialBarcodePrintSheet({
  reservationId,
  rangeStart,
  rangeEnd,
  seriesName,
  labelConfig = DEFAULT_BARCODE_LABEL_CONFIG,
  autoPrint,
  onStatusChange,
  onProgress,
}: SerialBarcodePrintSheetProps) {
  const serials = React.useMemo(
    () => listSerialNumbersInRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );
  const rootRef = React.useRef<HTMLDivElement>(null);
  const onStatusChangeRef = React.useRef(onStatusChange);
  const onProgressRef = React.useRef(onProgress);
  const labelConfigRef = React.useRef(labelConfig);
  onStatusChangeRef.current = onStatusChange;
  onProgressRef.current = onProgress;
  labelConfigRef.current = labelConfig;

  React.useEffect(() => {
    onStatusChangeRef.current?.("preparing");
    onProgressRef.current?.(0, serials.length);
    let cancelled = false;

    void (async () => {
      const { default: JsBarcode } = await import("jsbarcode");
      if (cancelled || !rootRef.current) {
        return;
      }

      await renderLabelsInBatches(
        rootRef.current,
        serials,
        seriesName,
        labelConfigRef.current,
        JsBarcode,
        (completed, total) => onProgressRef.current?.(completed, total),
      );
      if (cancelled) {
        return;
      }

      onStatusChangeRef.current?.("ready");

      const storageKey = serialPrintSessionKey(reservationId);
      const shouldAutoPrint = autoPrint && !sessionStorage.getItem(storageKey);
      if (!shouldAutoPrint) {
        onStatusChangeRef.current?.("done");
        return;
      }

      sessionStorage.setItem(storageKey, String(Date.now()));
      onStatusChangeRef.current?.("printing");
      await waitForNextFrame();

      if (!cancelled) {
        window.print();
        onStatusChangeRef.current?.("done");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoPrint, reservationId, serials, seriesName, labelConfig]);

  return (
    <div id="serial-barcode-print-root" ref={rootRef} className="hidden print:block" aria-hidden />
  );
}
