"use client";

import * as React from "react";

import type { LabelBindingContext, LabelTemplate } from "@/lib/label-template-types";
import { printLabelTemplateGrid, renderLabelToDom } from "@/lib/label-template-render";

const LABEL_BATCH_SIZE = 24;

export type LabelPrintStatus = "preparing" | "ready" | "printing" | "done";

export type LabelBatchPrintSheetProps = {
  contexts: LabelBindingContext[];
  template: LabelTemplate;
  autoPrint: boolean;
  sessionKey: string;
  onStatusChange?: (status: LabelPrintStatus) => void;
  onProgress?: (completed: number, total: number) => void;
  rootId?: string;
};

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function LabelBatchPrintSheet({
  contexts,
  template,
  autoPrint,
  sessionKey,
  onStatusChange,
  onProgress,
  rootId = "label-batch-print-root",
}: LabelBatchPrintSheetProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const onStatusChangeRef = React.useRef(onStatusChange);
  const onProgressRef = React.useRef(onProgress);
  const templateRef = React.useRef(template);
  onStatusChangeRef.current = onStatusChange;
  onProgressRef.current = onProgress;
  templateRef.current = template;

  React.useEffect(() => {
    onStatusChangeRef.current?.("preparing");
    onProgressRef.current?.(0, contexts.length);
    let cancelled = false;

    void (async () => {
      if (cancelled || !rootRef.current || contexts.length === 0) {
        onStatusChangeRef.current?.("done");
        return;
      }

      const root = rootRef.current;
      root.replaceChildren();
      const printGrid = document.createElement("div");
      printGrid.className = "label-print-grid";
      root.appendChild(printGrid);

      const total = contexts.length;
      onProgressRef.current?.(0, total);

      for (let index = 0; index < contexts.length; index += LABEL_BATCH_SIZE) {
        const batch = contexts.slice(index, index + LABEL_BATCH_SIZE);
        const fragment = document.createDocumentFragment();

        for (const context of batch) {
          const label = document.createElement("article");
          label.className = "label-template-root";
          await renderLabelToDom(templateRef.current, context, label);
          fragment.appendChild(label);
        }

        printGrid.appendChild(fragment);
        onProgressRef.current?.(Math.min(index + batch.length, total), total);
        await waitForNextFrame();
      }

      if (cancelled) {
        return;
      }

      onStatusChangeRef.current?.("ready");

      const shouldAutoPrint =
        autoPrint &&
        typeof sessionStorage !== "undefined" &&
        !sessionStorage.getItem(sessionKey);

      if (!shouldAutoPrint) {
        onStatusChangeRef.current?.("done");
        return;
      }

      sessionStorage.setItem(sessionKey, String(Date.now()));
      onStatusChangeRef.current?.("printing");
      await waitForNextFrame();

      if (!cancelled) {
        await printLabelTemplateGrid(printGrid, templateRef.current);
        onStatusChangeRef.current?.("done");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoPrint, contexts, sessionKey, template]);

  return <div id={rootId} ref={rootRef} aria-hidden />;
}
