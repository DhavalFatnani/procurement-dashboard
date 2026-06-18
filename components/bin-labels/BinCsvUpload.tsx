"use client";

import * as React from "react";

import { buildBinLabelCsvSample } from "@/lib/bin-label-csv";
import { cn } from "@/lib/utils";
import { FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_FILE_BYTES = 256 * 1024;

export function BinCsvUpload({
  onFileRead,
  disabled,
  className,
}: {
  onFileRead: (text: string, fileName: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function processFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Please upload a .csv file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("File is too large (max 256 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setFileName(file.name);
      onFileRead(text, file.name);
    };
    reader.onerror = () => setError("Could not read file.");
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function downloadSample() {
    const blob = new Blob([buildBinLabelCsvSample()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bin-labels-sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
          dragOver ? "border-primary bg-[var(--accent-subtle)]" : "border-border-subtle bg-muted/20",
          disabled && "opacity-50",
        )}
      >
        <Upload className="size-8 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-ds-sm font-medium text-foreground">Upload bin CSV</p>
          <p className="text-ds-xs text-muted-foreground">
            One column (bin codes) or columns: bin_code, zone, aisle, shelf
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="size-4" aria-hidden />
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            e.target.value = "";
          }}
        />
        {fileName ? (
          <p className="text-ds-xs text-muted-foreground">
            Loaded: <span className="font-medium text-foreground">{fileName}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={downloadSample}>
          Download sample CSV
        </Button>
      </div>
      {error ? <p className="text-ds-xs text-destructive">{error}</p> : null}
    </div>
  );
}
