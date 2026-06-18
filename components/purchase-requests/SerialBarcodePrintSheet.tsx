"use client";

import * as React from "react";

import { LabelBatchPrintSheet } from "@/components/label-studio/LabelBatchPrintSheet";
import type { LabelTemplate } from "@/lib/label-template-types";
import { getReferencePreset } from "@/lib/label-template-presets";
import { listSerialNumbersInRange, serialPrintSessionKey } from "@/lib/serial-range";

export type SerialBarcodePrintSheetProps = {
  reservationId: string;
  rangeStart: string;
  rangeEnd: string;
  seriesName: string;
  labelTemplate?: LabelTemplate;
  prId?: string;
  autoPrint: boolean;
  onStatusChange?: (status: "preparing" | "ready" | "printing" | "done") => void;
  onProgress?: (completed: number, total: number) => void;
};

export function SerialBarcodePrintSheet({
  reservationId,
  rangeStart,
  rangeEnd,
  seriesName,
  labelTemplate = getReferencePreset(),
  prId,
  autoPrint,
  onStatusChange,
  onProgress,
}: SerialBarcodePrintSheetProps) {
  const serials = React.useMemo(
    () => listSerialNumbersInRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const contexts = React.useMemo(
    () =>
      serials.map((serial) => ({
        serial,
        seriesName,
        prId,
        prNumber: prId,
        reservationId,
      })),
    [serials, seriesName, prId, reservationId],
  );

  return (
    <LabelBatchPrintSheet
      contexts={contexts}
      template={labelTemplate}
      autoPrint={autoPrint}
      sessionKey={serialPrintSessionKey(reservationId)}
      onStatusChange={onStatusChange}
      onProgress={onProgress}
      rootId="serial-barcode-print-root"
    />
  );
}

export default SerialBarcodePrintSheet;
