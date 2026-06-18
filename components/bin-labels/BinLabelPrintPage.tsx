"use client";

import * as React from "react";
import { toast } from "sonner";

import { LabelBatchPrintSheet } from "@/components/label-studio/LabelBatchPrintSheet";
import { BinCsvUpload } from "@/components/bin-labels/BinCsvUpload";
import { BinLabelPreviewCompact } from "@/components/bin-labels/BinLabelPreviewCompact";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { binRowsToBindingContexts } from "@/lib/bin-label-context";
import { parseBinLabelCsv } from "@/lib/bin-label-csv";
import type { BinPrintRow } from "@/lib/bin-label-types";
import type { WarehouseOption } from "@/lib/format-warehouse";
import {
  downloadThermalFile,
  generateEplBatchForContexts,
  generateZplBatchForContexts,
} from "@/lib/label-thermal-export";
import type { LabelTemplate, ResolvedLabelTemplate } from "@/lib/label-template-types";
import { loadBinPrintTemplateOverride } from "@/lib/bin-label-print-override";
import { Loader2, Printer } from "lucide-react";

type PrintStatus = "idle" | "preparing" | "ready" | "printing" | "done";

function binPrintSessionKey(warehouseId: string, batchId: string): string {
  return `knot-bin-print:${warehouseId}:${batchId}`;
}

export function BinLabelPrintPage({
  warehouses,
  initialTemplate,
  resolved,
}: {
  warehouses: WarehouseOption[];
  initialTemplate: LabelTemplate;
  resolved: ResolvedLabelTemplate;
}) {
  const [template, setTemplate] = React.useState(initialTemplate);
  const [warehouseId, setWarehouseId] = React.useState(warehouses[0]?.id ?? "");
  const [rows, setRows] = React.useState<BinPrintRow[]>([]);
  const [parseErrors, setParseErrors] = React.useState<string[]>([]);
  const [printStatus, setPrintStatus] = React.useState<PrintStatus>("idle");
  const [printProgress, setPrintProgress] = React.useState({ completed: 0, total: 0 });
  const [mountPrint, setMountPrint] = React.useState(false);
  const [batchId, setBatchId] = React.useState(() => crypto.randomUUID());

  const warehouse = warehouses.find((w) => w.id === warehouseId);
  const warehouseName = warehouse?.label ?? "";

  React.useEffect(() => {
    const override = loadBinPrintTemplateOverride();
    if (override) {
      setTemplate(override);
    }
  }, []);

  const contexts = React.useMemo(
    () => (warehouseName && rows.length > 0 ? binRowsToBindingContexts(rows, warehouseName) : []),
    [rows, warehouseName],
  );

  const previewContext = contexts[0] ?? {
    serial: "",
    seriesName: "",
    binCode: "A-12-03",
    warehouseName: warehouseName || "WH1 · Andheri",
    zone: "Zone A",
    aisle: "12",
    shelf: "03",
  };

  const canPrint = Boolean(warehouseId && rows.length > 0 && parseErrors.length === 0);
  const isPrinting = printStatus !== "idle" && printStatus !== "done";

  function handleCsvRead(text: string) {
    const result = parseBinLabelCsv(text);
    setRows(result.rows);
    setParseErrors(result.errors);
    setBatchId(crypto.randomUUID());
    setPrintStatus("idle");
    setMountPrint(false);
    if (result.rows.length > 0 && result.errors.length === 0) {
      toast.success(`Loaded ${result.rows.length} bin codes.`);
    } else if (result.errors.length > 0) {
      toast.error("Fix CSV errors before printing.");
    }
  }

  function handlePrint() {
    if (!canPrint) return;
    setMountPrint(true);
    setPrintStatus("preparing");
  }

  function handleDownloadZpl() {
    if (!canPrint) return;
    const content = generateZplBatchForContexts(template, contexts);
    downloadThermalFile(content, `bin-labels-${warehouseId}.zpl`);
  }

  function handleDownloadEpl() {
    if (!canPrint) return;
    const content = generateEplBatchForContexts(template, contexts);
    downloadThermalFile(content, `bin-labels-${warehouseId}.epl`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Print bin labels"
        subtitle="Upload a CSV of bin codes, pick a warehouse, preview your layout, then print or download for thermal printers."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="bin-warehouse" className="sr-only">
                Warehouse
              </Label>
              <Select value={warehouseId} onValueChange={setWarehouseId} disabled={isPrinting}>
                <SelectTrigger id="bin-warehouse">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Bin list (CSV)</CardTitle>
            </CardHeader>
            <CardContent>
              <BinCsvUpload onFileRead={handleCsvRead} disabled={isPrinting} />
            </CardContent>
          </Card>

          {rows.length > 0 ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle>
                  {rows.length} bin{rows.length === 1 ? "" : "s"} loaded
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {parseErrors.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-ds-xs text-destructive">
                    {parseErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="overflow-x-auto rounded-lg border border-border-subtle">
                  <table className="w-full min-w-[280px] text-left text-ds-xs">
                    <thead className="border-b border-border-subtle bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Bin code</th>
                        <th className="px-3 py-2 font-medium">Zone</th>
                        <th className="px-3 py-2 font-medium">Aisle</th>
                        <th className="px-3 py-2 font-medium">Shelf</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 10).map((row) => (
                        <tr key={row.binCode} className="border-b border-border-subtle last:border-0">
                          <td className="px-3 py-2 font-mono">{row.binCode}</td>
                          <td className="px-3 py-2">{row.zone ?? "—"}</td>
                          <td className="px-3 py-2">{row.aisle ?? "—"}</td>
                          <td className="px-3 py-2">{row.shelf ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 10 ? (
                  <p className="text-ds-xs text-muted-foreground">
                    Showing first 10 of {rows.length} rows.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <BinLabelPreviewCompact
            template={template}
            resolved={resolved}
            context={previewContext}
          />

          {isPrinting ? (
            <Card size="sm" className="border-[color-mix(in_srgb,var(--brand-accent)_25%,transparent)] bg-[var(--accent-subtle)]">
              <CardContent className="flex items-center gap-3 pt-5">
                <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
                <div>
                  <p className="text-ds-sm font-medium">Preparing labels</p>
                  <p className="text-ds-xs text-muted-foreground">
                    {printProgress.completed} / {printProgress.total} labels
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!canPrint || isPrinting} onClick={handlePrint}>
              <Printer className="size-4" aria-hidden />
              Print labels
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrint || isPrinting}
              onClick={handleDownloadZpl}
            >
              Download ZPL
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrint || isPrinting}
              onClick={handleDownloadEpl}
            >
              Download EPL
            </Button>
          </div>
        </div>
      </div>

      {mountPrint && contexts.length > 0 ? (
        <LabelBatchPrintSheet
          contexts={contexts}
          template={template}
          autoPrint
          sessionKey={binPrintSessionKey(warehouseId, batchId)}
          onStatusChange={setPrintStatus}
          onProgress={(completed, total) => setPrintProgress({ completed, total })}
          rootId="bin-label-print-root"
        />
      ) : null}
    </div>
  );
}
