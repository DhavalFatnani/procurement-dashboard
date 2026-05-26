"use client";

import type { ReactNode } from "react";

import { BarcodeLabelPreview } from "@/components/purchase-requests/BarcodeLabelPreview";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { BarcodeLabelConfig } from "@/lib/barcode-label-config";
import {
  BARCODE_BRAND_SIZE_OPTIONS,
  BARCODE_MARGIN_MM_MAX,
  BARCODE_MARGIN_MM_MIN,
  BARCODE_MARGIN_PRESETS_MM,
  BARCODE_MAX_WIDTH_PERCENT_MAX,
  BARCODE_MAX_WIDTH_PERCENT_MIN,
  BARCODE_MODULE_WIDTH_MAX,
  BARCODE_MODULE_WIDTH_MIN,
  BARCODE_PAGE_SIZE_GROUPS,
  BARCODE_PAGE_SIZE_OPTIONS,
  BARCODE_TEXT_GAP_MM_MAX,
  BARCODE_TEXT_GAP_MM_MIN,
  isBarcodeLabelStock,
} from "@/lib/barcode-label-config";
import { cn } from "@/lib/utils";
import { Lock, LockOpen, SlidersHorizontal } from "lucide-react";

function ConfigGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-ds-xs font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mt-0.5 text-ds-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SliderControl({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
  presets,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  presets?: readonly number[];
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-muted/20 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-ds-xs text-muted-foreground">
            {label}
          </Label>
          {hint ? (
            <p className="mt-0.5 text-ds-2xs leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-ds-xs font-medium tabular-nums text-foreground">
          {step < 1 ? value.toFixed(1) : value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary disabled:opacity-50"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {presets && presets.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              className={cn(
                "rounded-md border px-2 py-0.5 text-ds-2xs font-medium transition-colors",
                value === preset
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border-subtle bg-card text-muted-foreground hover:bg-muted/40",
                disabled && "pointer-events-none opacity-50",
              )}
              onClick={() => onChange(preset)}
            >
              {preset}
              {unit}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-subtle bg-card px-3 py-2.5 transition-colors",
        disabled && "pointer-events-none opacity-50",
        !disabled && "hover:bg-muted/30",
      )}
    >
      <span className="text-ds-sm text-foreground">{label}</span>
      <input
        type="checkbox"
        className="size-4 shrink-0 rounded border-input accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function BarcodeLabelConfigSection({
  config,
  onChange,
  disabled = false,
  layoutLocked = false,
  onLockLayout,
  onUnlockLayout,
  seriesName,
  sampleSerial,
  className,
  embedded = false,
}: {
  config: BarcodeLabelConfig;
  onChange: (config: BarcodeLabelConfig) => void;
  disabled?: boolean;
  layoutLocked?: boolean;
  onLockLayout?: () => void;
  onUnlockLayout?: () => void;
  seriesName?: string;
  sampleSerial?: string;
  className?: string;
  /** When true, omits outer chrome for use inside the reserve modal column. */
  embedded?: boolean;
}) {
  const pageHint =
    BARCODE_PAGE_SIZE_OPTIONS.find((o) => o.value === config.pageSize)?.hint ?? "";
  const controlsDisabled = disabled || layoutLocked;
  const canToggleLock = Boolean(onLockLayout && onUnlockLayout);
  const isLabel = isBarcodeLabelStock(config.pageSize);
  const marginHint = isLabel
    ? "Inner padding inside the label die (page size is fixed)."
    : "Printer non-printable area on the sheet (@page margin).";

  return (
    <section
      className={cn(
        "flex h-full flex-col",
        !embedded && "space-y-4 rounded-xl border border-border-subtle bg-card p-4",
        className,
      )}
      aria-labelledby="barcode-label-config-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SlidersHorizontal className="size-4" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step 2
            </span>
            {layoutLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-ds-2xs font-medium text-primary">
                <Lock className="size-3" strokeWidth={1.5} aria-hidden />
                Default locked
              </span>
            ) : null}
          </div>
          <h3
            id="barcode-label-config-heading"
            className="text-ds-md font-semibold tracking-tight text-foreground"
          >
            Label &amp; page setup
          </h3>
          <p className="text-ds-sm leading-relaxed text-muted-foreground">
            {layoutLocked
              ? "Your saved default layout is applied to every internal print. Unlock to change it."
              : "Configure how labels print after reservation. Lock when done to reuse next time."}
          </p>
        </div>
        {canToggleLock ? (
          layoutLocked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="shrink-0 gap-1.5"
              onClick={onUnlockLayout}
            >
              <LockOpen className="size-3.5" strokeWidth={1.5} />
              Unlock
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              className="shrink-0 gap-1.5"
              onClick={onLockLayout}
            >
              <Lock className="size-3.5" strokeWidth={1.5} />
              Lock default
            </Button>
          )
        ) : null}
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-5">
        <div
          className={cn(
            "grid gap-6",
            embedded
              ? "grid-cols-1"
              : "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(220px,260px)] xl:items-start",
          )}
        >
          <div className="min-w-0 space-y-5">
            <ConfigGroup title="Page setup" description="Paper or label stock in your printer.">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="barcode-page-size" className="text-ds-xs text-muted-foreground">
                    Page / label size
                  </Label>
                  <Select
                    value={config.pageSize}
                    onValueChange={(pageSize) =>
                      onChange({
                        ...config,
                        pageSize: pageSize as BarcodeLabelConfig["pageSize"],
                      })
                    }
                    disabled={controlsDisabled}
                  >
                    <SelectTrigger id="barcode-page-size" size="sm" className="w-full bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(20rem,70vh)]">
                      {BARCODE_PAGE_SIZE_GROUPS.map((group) => (
                        <SelectGroup key={group.id}>
                          <SelectLabel>{group.label}</SelectLabel>
                          {BARCODE_PAGE_SIZE_OPTIONS.filter((o) => o.group === group.id).map(
                            (opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ),
                          )}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {pageHint ? (
                    <p className="text-ds-xs text-muted-foreground">{pageHint}</p>
                  ) : null}
                </div>

                <SliderControl
                  id="barcode-margin-mm"
                  label={isLabel ? "Inner margin" : "Page margin"}
                  hint={marginHint}
                  value={config.marginMm}
                  min={BARCODE_MARGIN_MM_MIN}
                  max={BARCODE_MARGIN_MM_MAX}
                  step={1}
                  unit="mm"
                  disabled={controlsDisabled}
                  presets={BARCODE_MARGIN_PRESETS_MM}
                  onChange={(marginMm) => onChange({ ...config, marginMm })}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="barcode-brand-size" className="text-ds-xs text-muted-foreground">
                    KNOT branding
                  </Label>
                  <Select
                    value={config.brandSize}
                    onValueChange={(brandSize) =>
                      onChange({
                        ...config,
                        brandSize: brandSize as BarcodeLabelConfig["brandSize"],
                      })
                    }
                    disabled={controlsDisabled}
                  >
                    <SelectTrigger id="barcode-brand-size" size="sm" className="w-full bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BARCODE_BRAND_SIZE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ConfigGroup>

            <ConfigGroup title="Layout" description="Spacing and barcode scale on the label.">
              <div className="space-y-3">
                <SliderControl
                  id="barcode-text-gap"
                  label="Vertical spacing"
                  hint="Gap between KNOT, barcode, and series name."
                  value={config.textGapMm}
                  min={BARCODE_TEXT_GAP_MM_MIN}
                  max={BARCODE_TEXT_GAP_MM_MAX}
                  step={1}
                  unit="mm"
                  disabled={controlsDisabled}
                  presets={[2, 4, 6, 8, 10]}
                  onChange={(textGapMm) => onChange({ ...config, textGapMm })}
                />
                <SliderControl
                  id="barcode-module-width"
                  label="Barcode bar width"
                  hint="Thicker bars fill more horizontal space (module width)."
                  value={config.barcodeModuleWidth}
                  min={BARCODE_MODULE_WIDTH_MIN}
                  max={BARCODE_MODULE_WIDTH_MAX}
                  step={0.1}
                  unit="×"
                  disabled={controlsDisabled}
                  presets={[1, 1.4, 1.8, 2.2, 2.6]}
                  onChange={(barcodeModuleWidth) => onChange({ ...config, barcodeModuleWidth })}
                />
                <SliderControl
                  id="barcode-max-width"
                  label="Barcode block width"
                  hint="Maximum width of the barcode area on the label."
                  value={config.barcodeMaxWidthPercent}
                  min={BARCODE_MAX_WIDTH_PERCENT_MIN}
                  max={BARCODE_MAX_WIDTH_PERCENT_MAX}
                  step={1}
                  unit="%"
                  disabled={controlsDisabled}
                  presets={[80, 88, 92, 96, 100]}
                  onChange={(barcodeMaxWidthPercent) =>
                    onChange({ ...config, barcodeMaxWidthPercent })
                  }
                />
                <SliderControl
                  id="barcode-height"
                  label="Bar height"
                  hint="Taller bars are easier to scan; keep within your label height."
                  value={config.barcodeHeight}
                  min={24}
                  max={72}
                  step={2}
                  unit="px"
                  disabled={controlsDisabled}
                  onChange={(barcodeHeight) => onChange({ ...config, barcodeHeight })}
                />
              </div>
            </ConfigGroup>

            <ConfigGroup title="On each label">
              <div className="space-y-2">
                <ToggleRow
                  label="Serial number under barcode"
                  checked={config.showBarcodeValue}
                  disabled={controlsDisabled}
                  onChange={(showBarcodeValue) => onChange({ ...config, showBarcodeValue })}
                />
                <ToggleRow
                  label="Series name"
                  checked={config.showSeriesName}
                  disabled={controlsDisabled}
                  onChange={(showSeriesName) => onChange({ ...config, showSeriesName })}
                />
              </div>
            </ConfigGroup>
          </div>

          <BarcodeLabelPreview
            config={config}
            seriesName={seriesName}
            sampleSerial={sampleSerial}
            className={cn(
              embedded ? "mx-auto w-full max-w-md" : "xl:sticky xl:top-0",
            )}
          />
        </div>
      </div>
    </section>
  );
}
