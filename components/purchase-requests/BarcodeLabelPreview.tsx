"use client";

import * as React from "react";

import {
  BARCODE_BRAND_SIZE_CHIPS,
  BARCODE_LABEL_PREVIEW_SCALE,
  formatTypographyScalePercent,
  getBarcodeLayoutCssVars,
  getBarcodePageSpec,
  getBarcodeTypographyMode,
  getPreviewMarginInsets,
  jsBarcodeOptionsFromConfig,
  resolveBarcodeTypography,
  type BarcodeLabelConfig,
  type BarcodePreviewHighlight,
} from "@/lib/barcode-label-config";
import { cn } from "@/lib/utils";

const PREVIEW_BARCODE_SCALE = BARCODE_LABEL_PREVIEW_SCALE;

function scaledPreviewFontPt(pt: number): string {
  return `${pt * BARCODE_LABEL_PREVIEW_SCALE}pt`;
}

function highlightRingClass(highlight: BarcodePreviewHighlight | undefined, region: BarcodePreviewHighlight) {
  if (highlight !== region) {
    return "";
  }
  return "ring-2 ring-primary/70 ring-offset-1 ring-offset-white rounded-sm";
}

export function BarcodeLabelPreview({
  config,
  seriesName,
  sampleSerial = "2000000000",
  compact = false,
  sticky = false,
  highlight,
  className,
}: {
  config: BarcodeLabelConfig;
  seriesName?: string;
  sampleSerial?: string;
  compact?: boolean;
  sticky?: boolean;
  highlight?: BarcodePreviewHighlight;
  className?: string;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const pageSpec = getBarcodePageSpec(config.pageSize);
  const marginInsets = getPreviewMarginInsets(config.pageSize, config.marginMm);
  const typographyMode = getBarcodeTypographyMode(config);
  const typography = resolveBarcodeTypography(config, typographyMode);
  const layoutVars = getBarcodeLayoutCssVars(config);
  const usePrintSizing = typographyMode === "label";
  const brandChipLabel =
    BARCODE_BRAND_SIZE_CHIPS.find((chip) => chip.value === config.brandSize)?.label ?? "M";

  const previewLayoutVars: Record<string, string> = usePrintSizing
    ? layoutVars
    : {
        ...layoutVars,
        "--serial-brand-font-pt": scaledPreviewFontPt(typography.brandFontPt),
        "--serial-series-font-pt": scaledPreviewFontPt(typography.seriesFontPt),
        "--serial-barcode-value-font-pt": scaledPreviewFontPt(typography.barcodeValueFontPt),
      };

  const barcodeRenderScale = usePrintSizing ? 1 : PREVIEW_BARCODE_SCALE;

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
        jsBarcodeOptionsFromConfig(config, barcodeRenderScale),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [config, sampleSerial, barcodeRenderScale]);

  return (
    <div
      className={cn(
        "relative flex w-full flex-col rounded-xl border border-border-subtle bg-card",
        compact ? "gap-2 p-3" : "gap-3 p-4",
        sticky && "lg:sticky lg:top-0 lg:z-10 lg:shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
          Print preview
        </p>
        {!compact ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-ds-2xs text-muted-foreground">
            1 per page
          </span>
        ) : null}
      </div>

      <div className={cn("mx-auto w-full", compact ? "max-w-[200px]" : "max-w-[280px]")}>
        <div
          className={cn(
            "relative overflow-hidden rounded-md border border-border-default shadow-ds transition-shadow",
            highlight === "margin" && "ring-2 ring-primary/50",
          )}
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
              "serial-label-preview-inner flex h-full w-full items-center justify-center overflow-hidden bg-white",
              marginInsets.marginMm > 0 && "ring-1 ring-inset ring-zinc-300/80",
            )}
          >
            <div
              className="serial-label-content text-[#111]"
              style={previewLayoutVars}
            >
              <p
                className={cn(
                  "serial-label-brand shrink-0 font-extrabold uppercase leading-none",
                  highlightRingClass(highlight, "knot"),
                )}
              >
                KNOT
              </p>

              <div className="serial-label-stack w-full">
                <div
                  className={cn(
                    "serial-label-barcode",
                    highlightRingClass(highlight, "barcode"),
                  )}
                  style={{ maxWidth: previewLayoutVars["--serial-barcode-max-width"] }}
                >
                  <svg ref={svgRef} className="max-w-full" role="img" aria-hidden />
                </div>

                {config.showBarcodeValue ? (
                  <p
                    className={cn(
                      "serial-label-value m-0 max-w-full shrink-0 truncate text-center",
                      highlightRingClass(highlight, "serial"),
                    )}
                  >
                    {sampleSerial}
                  </p>
                ) : null}

                {config.showSeriesName ? (
                  <p
                    className={cn(
                      "serial-label-series m-0 max-w-full shrink-0 truncate text-center text-[#444] leading-snug",
                      highlightRingClass(highlight, "series"),
                    )}
                  >
                    {seriesName ?? "Series name"}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "text-muted-foreground",
          compact
            ? "truncate text-center text-ds-2xs"
            : "flex flex-wrap items-center justify-center gap-2 text-ds-2xs",
        )}
      >
        {compact ? (
          <span>
            {pageSpec.label} · KNOT {formatTypographyScalePercent(config.typographyScale)} · Serial{" "}
            {formatTypographyScalePercent(config.barcodeValueScale)} ({typography.barcodeValueFontPt}
            pt)
          </span>
        ) : (
          <>
            <span>{pageSpec.label}</span>
            <span aria-hidden>·</span>
            <span className="font-medium text-foreground">{marginInsets.label}</span>
            <span aria-hidden>·</span>
            <span>
              KNOT {typography.brandFontPt}pt · Serial {typography.barcodeValueFontPt}pt · Series{" "}
              {typography.seriesFontPt}pt · {brandChipLabel}
            </span>
            <span aria-hidden>·</span>
            <span>
              KNOT gap {config.brandBarcodeGapMm} mm · text {config.textGapMm} mm · bar{" "}
              {config.barcodeModuleWidth.toFixed(1)}× · {config.barcodeMaxWidthPercent}% wide
            </span>
            {usePrintSizing ? (
              <>
                <span aria-hidden>·</span>
                <span>auto-scales to fit label</span>
              </>
            ) : null}
            {marginInsets.marginMm > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm bg-zinc-400" aria-hidden />
                  shaded = margin
                </span>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
