"use client";

import * as React from "react";

import {
  getBarcodeLayoutCssVars,
  getBarcodePageSpec,
  getPreviewMarginInsets,
  isBarcodeLabelStock,
  jsBarcodeOptionsFromConfig,
  type BarcodeBrandSize,
  type BarcodeLabelConfig,
} from "@/lib/barcode-label-config";
import { cn } from "@/lib/utils";

const PREVIEW_BARCODE_SCALE = 0.55;

const BRAND_PREVIEW_CLASS: Record<
  BarcodeBrandSize,
  { sheet: string; label: string }
> = {
  medium: {
    sheet: "text-[10px] tracking-[0.28em]",
    label: "text-[7px] tracking-[0.22em]",
  },
  large: {
    sheet: "text-[13px] tracking-[0.32em]",
    label: "text-[9px] tracking-[0.26em]",
  },
  xlarge: {
    sheet: "text-[16px] tracking-[0.34em]",
    label: "text-[11px] tracking-[0.28em]",
  },
  xxlarge: {
    sheet: "text-[20px] tracking-[0.36em]",
    label: "text-[13px] tracking-[0.3em]",
  },
  display: {
    sheet: "text-[24px] tracking-[0.38em]",
    label: "text-[15px] tracking-[0.32em]",
  },
};

export function BarcodeLabelPreview({
  config,
  seriesName,
  sampleSerial = "2000000000",
  className,
}: {
  config: BarcodeLabelConfig;
  seriesName?: string;
  sampleSerial?: string;
  className?: string;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const pageSpec = getBarcodePageSpec(config.pageSize);
  const marginInsets = getPreviewMarginInsets(config.pageSize, config.marginMm);
  const isLabel = isBarcodeLabelStock(config.pageSize);
  const layoutVars = getBarcodeLayoutCssVars(config);
  const brandClass = BRAND_PREVIEW_CLASS[config.brandSize][isLabel ? "label" : "sheet"];

  React.useEffect(() => {
    let cancelled = false;
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    void (async () => {
      const { default: JsBarcode } = await import("jsbarcode");
      if (cancelled || !svgRef.current) {
        return;
      }
      svgRef.current.replaceChildren();
      JsBarcode(
        svgRef.current,
        sampleSerial,
        jsBarcodeOptionsFromConfig(config, PREVIEW_BARCODE_SCALE),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [config, sampleSerial]);

  return (
    <div
      className={cn(
        "relative flex w-full flex-col gap-3 rounded-xl border border-border-subtle bg-gradient-to-b from-muted/30 to-background p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
          Print preview
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-ds-2xs text-muted-foreground">
          1 per page
        </span>
      </div>

      <div className="mx-auto w-full max-w-[300px]">
        <div
          className="relative overflow-hidden rounded-md border border-border-default shadow-ds"
          style={{
            aspectRatio: pageSpec.aspectRatio,
            padding: `${marginInsets.yPercent}% ${marginInsets.xPercent}%`,
            backgroundColor: "#d4d4d8",
            backgroundImage:
              marginInsets.marginMm > 0
                ? "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.35) 4px, rgba(255,255,255,0.35) 8px)"
                : undefined,
          }}
        >
          <div
            className={cn(
              "flex h-full w-full flex-col items-center justify-center bg-white text-[#111]",
              marginInsets.marginMm > 0 && "ring-1 ring-inset ring-zinc-300/80",
              isLabel ? "px-1 py-1" : "px-3 py-2",
            )}
            style={{
              ...layoutVars,
              gap: layoutVars["--serial-text-gap-mm"],
            }}
          >
            <p
              className={cn(
                "m-0 shrink-0 font-extrabold uppercase leading-none text-[#111]",
                brandClass,
              )}
            >
              KNOT
            </p>

            <div
              className="flex min-h-0 w-full flex-1 items-center justify-center"
              style={{ maxWidth: layoutVars["--serial-barcode-max-width"] }}
            >
              <svg ref={svgRef} className="max-h-full max-w-full" role="img" aria-hidden />
            </div>

            {config.showSeriesName ? (
              <p
                className={cn(
                  "m-0 max-w-full shrink-0 truncate text-center text-[#444]",
                  isLabel ? "text-[6px] leading-tight" : "text-[8px] leading-snug",
                )}
              >
                {seriesName ?? "Series name"}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-ds-2xs text-muted-foreground">
        <span>{pageSpec.label}</span>
        <span aria-hidden>·</span>
        <span className="font-medium text-foreground">{marginInsets.label}</span>
        <span aria-hidden>·</span>
        <span>
          gap {config.textGapMm} mm · bar {config.barcodeModuleWidth.toFixed(1)}× ·{" "}
          {config.barcodeMaxWidthPercent}% wide
        </span>
        {marginInsets.marginMm > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2 rounded-sm bg-zinc-400" aria-hidden />
              shaded = margin
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
