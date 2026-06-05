"use client";

import type { ReactNode } from "react";
import * as React from "react";
import type { SeriesCode } from "@/lib/series-codes";

import { BarcodeFontSizeStepper } from "@/components/purchase-requests/BarcodeFontSizeStepper";
import { BarcodeLabelPreview } from "@/components/purchase-requests/BarcodeLabelPreview";
import { Button } from "@/components/ui/button";
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
import type { BarcodeLabelConfig, BarcodePreviewHighlight } from "@/lib/barcode-label-config";
import {
  applyBarcodeLayoutPreset,
  BARCODE_BRAND_SIZE_CHIPS,
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
  BARCODE_VALUE_SCALE_MAX,
  BARCODE_VALUE_SCALE_MIN,
  BARCODE_SERIES_NAME_SCALE_MAX,
  BARCODE_SERIES_NAME_SCALE_MIN,
  clampBarcodeValueScale,
  clampSeriesNameScale,
  DEFAULT_BARCODE_LABEL_CONFIG,
  getActiveBarcodeLayoutPresetId,
  getBarcodeControlHints,
  getBarcodeLayoutPresetContext,
  getBarcodeLayoutPresetContextHint,
  getBarcodeLayoutPresetContextLabel,
  getBarcodeLayoutPresetsForContext,
  getBarcodePageSpec,
  getBarcodeTypographyMode,
  isBarcodeLabelConfigDefault,
  isBarcodeLabelStock,
  normalizeBarcodeLabelConfig,
  resolveBarcodeTypography,
} from "@/lib/barcode-label-config";
import { cn } from "@/lib/utils";
import { Lock, LockOpen, RotateCcw, SlidersHorizontal } from "lucide-react";

function SetupSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-ds-sm font-semibold text-foreground">{title}</h4>
        {description ? (
          <p className="mt-0.5 text-ds-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SetupRow({
  title,
  description,
  affects,
  children,
  highlight,
  onHighlight,
  disabled,
}: {
  title: string;
  description?: string;
  affects?: string;
  children: ReactNode;
  highlight?: BarcodePreviewHighlight;
  onHighlight?: (highlight: BarcodePreviewHighlight | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-muted/15 px-3 py-3 transition-colors",
        disabled && "opacity-60",
      )}
      onMouseEnter={() => onHighlight?.(highlight)}
      onMouseLeave={() => onHighlight?.(undefined)}
      onFocusCapture={() => onHighlight?.(highlight)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onHighlight?.(undefined);
        }
      }}
    >
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-ds-xs font-medium text-foreground">{title}</p>
          {description ? (
            <p className="mt-0.5 text-ds-2xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {affects ? (
            <p className="mt-1 text-ds-2xs text-[var(--brand-accent)]">Affects: {affects}</p>
          ) : null}
        </div>
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
  const safeValue = Number.isFinite(value) ? value : min;

  return (
    <div className="space-y-2">
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
          {step < 1 ? safeValue.toFixed(1) : safeValue}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
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
                  ? "border-[color-mix(in_srgb,var(--brand-accent)_40%,transparent)] surface-accent-soft"
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
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border-subtle bg-card px-3 py-2.5 transition-colors",
        disabled && "pointer-events-none opacity-50",
        !disabled && "hover:bg-muted/30",
      )}
    >
      <span className="min-w-0">
        <span className="block text-ds-sm text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-ds-2xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function BarcodeLabelSetupPanel({
  config: incomingConfig,
  onChange,
  disabled = false,
  layoutLocked = false,
  onLockLayout,
  onUnlockLayout,
  series,
  seriesName,
  sampleSerial,
  className,
}: {
  config: BarcodeLabelConfig;
  onChange: (config: BarcodeLabelConfig) => void;
  disabled?: boolean;
  layoutLocked?: boolean;
  onLockLayout?: () => void;
  onUnlockLayout?: () => void;
  series?: SeriesCode;
  seriesName?: string;
  sampleSerial?: string;
  className?: string;
}) {
  const config = React.useMemo(
    () => normalizeBarcodeLabelConfig(incomingConfig),
    [incomingConfig],
  );

  const migrationDoneRef = React.useRef(false);

  React.useEffect(() => {
    if (migrationDoneRef.current || typeof incomingConfig.brandBarcodeGapMm === "number") {
      return;
    }
    migrationDoneRef.current = true;
    onChange(config);
  }, [config, incomingConfig.brandBarcodeGapMm, onChange]);

  const hints = getBarcodeControlHints();
  const [highlight, setHighlight] = React.useState<BarcodePreviewHighlight | undefined>();
  const controlsDisabled = disabled || layoutLocked;
  const canToggleLock = Boolean(onLockLayout && onUnlockLayout);
  const presetContext = series ? getBarcodeLayoutPresetContext(series) : "jewellery";
  const layoutPresets = getBarcodeLayoutPresetsForContext(presetContext);
  const presetContextLabel = getBarcodeLayoutPresetContextLabel(presetContext);
  const presetContextHint = getBarcodeLayoutPresetContextHint(presetContext);
  const activePresetId = getActiveBarcodeLayoutPresetId(config, presetContext);
  const typographyMode = getBarcodeTypographyMode(config);
  const typography = resolveBarcodeTypography(config, typographyMode);
  const isLabel = isBarcodeLabelStock(config.pageSize);
  const pageHint = BARCODE_PAGE_SIZE_OPTIONS.find((o) => o.value === config.pageSize)?.hint ?? "";
  const hasDraftChanges = !layoutLocked && !isBarcodeLabelConfigDefault(config);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl surface-accent-soft">
          <SlidersHorizontal className="size-4" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step 2
            </span>
            {layoutLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--brand-accent)_30%,transparent)] surface-accent-soft px-2 py-0.5 text-ds-2xs font-medium">
                <Lock className="size-3" strokeWidth={1.5} aria-hidden />
                Default locked
              </span>
            ) : null}
          </div>
          <h3 className="text-ds-md font-semibold tracking-tight text-foreground">
            Label &amp; page setup
          </h3>
          <p className="text-ds-sm leading-relaxed text-muted-foreground">
            {layoutLocked
              ? "Your saved default layout is applied to every internal print. Unlock to change it."
              : "Pick a label stock, preview the result, then lock when you are happy."}
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

      {layoutLocked ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--brand-accent)_25%,transparent)] bg-[var(--accent-subtle)] px-3 py-2.5">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-[var(--brand-accent)]" strokeWidth={1.5} aria-hidden />
          <p className="text-ds-xs leading-relaxed text-foreground">
            Using your saved default layout for every internal print.
          </p>
        </div>
      ) : hasDraftChanges ? (
        <p className="mt-4 text-ds-2xs text-muted-foreground">
          Changes auto-save in this browser while unlocked.
        </p>
      ) : null}

      <BarcodeLabelPreview
        config={config}
        seriesName={seriesName}
        sampleSerial={sampleSerial}
        highlight={highlight}
        sticky
        className="mt-5"
      />

      <div className="mt-6 space-y-6 divide-y divide-border-subtle">
        <SetupSection title={`${presetContextLabel} label stock`} description={presetContextHint}>
          <div className="grid gap-2 sm:grid-cols-3">
            {layoutPresets.map((preset) => {
              const spec = preset.config.pageSize
                ? getBarcodePageSpec(preset.config.pageSize)
                : null;
              const selected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={controlsDisabled}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    selected
                      ? "border-[color-mix(in_srgb,var(--brand-accent)_50%,transparent)] surface-accent-soft ring-1 ring-[color-mix(in_srgb,var(--brand-accent)_30%,transparent)]"
                      : "border-border-subtle bg-card hover:bg-muted/30",
                    controlsDisabled && "pointer-events-none opacity-50",
                  )}
                  onClick={() => onChange(applyBarcodeLayoutPreset(config, preset.id, presetContext))}
                >
                  <p className="text-ds-xs font-semibold text-foreground">{preset.label}</p>
                  {spec ? (
                    <p className="mt-1 text-ds-2xs leading-relaxed text-muted-foreground">
                      {spec.hint}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          <SetupRow
            title={hints.pageSize.title}
            description={hints.pageSize.description}
            affects={hints.pageSize.affects}
            highlight="margin"
            onHighlight={setHighlight}
            disabled={controlsDisabled}
          >
            <div className="space-y-1.5">
              <Label htmlFor="barcode-page-size" className="text-ds-xs text-muted-foreground">
                Other sizes
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
                      {BARCODE_PAGE_SIZE_OPTIONS.filter((o) => o.group === group.id).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {pageHint ? <p className="text-ds-2xs text-muted-foreground">{pageHint}</p> : null}
            </div>
          </SetupRow>

          {!layoutLocked ? (
            <button
              type="button"
              disabled={disabled || isBarcodeLabelConfigDefault(config)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-ds-2xs font-medium transition-colors",
                "border-border-subtle bg-card text-muted-foreground hover:bg-muted/40",
                (disabled || isBarcodeLabelConfigDefault(config)) &&
                  "pointer-events-none opacity-50",
              )}
              onClick={() => onChange(DEFAULT_BARCODE_LABEL_CONFIG)}
            >
              <RotateCcw className="size-3" strokeWidth={1.5} aria-hidden />
              Reset all to factory defaults
            </button>
          ) : null}
        </SetupSection>

        <SetupSection title="What to print" description="Choose which lines appear on each label.">
          <div className="space-y-2">
            <ToggleRow
              label={hints.showSerial.title}
              description={hints.showSerial.description}
              checked={config.showBarcodeValue}
              disabled={controlsDisabled}
              onChange={(showBarcodeValue) => onChange({ ...config, showBarcodeValue })}
            />
            <ToggleRow
              label={hints.showSeries.title}
              description={hints.showSeries.description}
              checked={config.showSeriesName}
              disabled={controlsDisabled}
              onChange={(showSeriesName) => onChange({ ...config, showSeriesName })}
            />
          </div>
        </SetupSection>

        <SetupSection
          title="Text sizes"
          description="Each control only changes the highlighted part of the preview."
        >
          <div className="space-y-3">
            <SetupRow
              title={hints.knot.title}
              description={hints.knot.description}
              affects={hints.knot.affects}
              highlight="knot"
              onHighlight={setHighlight}
              disabled={controlsDisabled}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {BARCODE_BRAND_SIZE_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      disabled={controlsDisabled}
                      className={cn(
                        "min-w-[2.25rem] rounded-md border px-2.5 py-1 text-ds-xs font-semibold transition-colors",
                        config.brandSize === chip.value
                          ? "border-[color-mix(in_srgb,var(--brand-accent)_40%,transparent)] surface-accent-soft"
                          : "border-border-subtle bg-card text-muted-foreground hover:bg-muted/40",
                        controlsDisabled && "pointer-events-none opacity-50",
                      )}
                      onClick={() => onChange({ ...config, brandSize: chip.value })}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label className="text-ds-2xs text-muted-foreground">Fine-tune KNOT size</Label>
                  <BarcodeFontSizeStepper
                    value={config.typographyScale}
                    disabled={controlsDisabled}
                    affectedLabel="KNOT text"
                    fontPt={typography.brandFontPt}
                    onChange={(typographyScale) => onChange({ ...config, typographyScale })}
                  />
                </div>
              </div>
            </SetupRow>

            <SetupRow
              title={hints.serial.title}
              description={hints.serial.description}
              affects={hints.serial.affects}
              highlight="serial"
              onHighlight={setHighlight}
              disabled={controlsDisabled}
            >
              <BarcodeFontSizeStepper
                value={config.barcodeValueScale}
                disabled={controlsDisabled || !config.showBarcodeValue}
                affectedLabel="Serial number"
                fontPt={typography.barcodeValueFontPt}
                scaleMin={BARCODE_VALUE_SCALE_MIN}
                scaleMax={BARCODE_VALUE_SCALE_MAX}
                onChange={(barcodeValueScale) =>
                  onChange({ ...config, barcodeValueScale: clampBarcodeValueScale(barcodeValueScale) })
                }
              />
            </SetupRow>

            <SetupRow
              title={hints.series.title}
              description={hints.series.description}
              affects={hints.series.affects}
              highlight="series"
              onHighlight={setHighlight}
              disabled={controlsDisabled}
            >
              <BarcodeFontSizeStepper
                value={config.seriesNameScale}
                disabled={controlsDisabled || !config.showSeriesName}
                affectedLabel="Series name"
                fontPt={typography.seriesFontPt}
                scaleMin={BARCODE_SERIES_NAME_SCALE_MIN}
                scaleMax={BARCODE_SERIES_NAME_SCALE_MAX}
                onChange={(seriesNameScale) =>
                  onChange({ ...config, seriesNameScale: clampSeriesNameScale(seriesNameScale) })
                }
              />
            </SetupRow>
          </div>
        </SetupSection>

        <SetupSection
          title="Spacing & margins"
          description="Adjust safe zones and vertical spacing between label elements."
        >
          <div className="space-y-3">
            <SetupRow
              title={hints.margin.title}
              description={
                isLabel
                  ? "Inner padding inside the label die — the shaded area in preview."
                  : hints.margin.description
              }
              affects={hints.margin.affects}
              highlight="margin"
              onHighlight={setHighlight}
              disabled={controlsDisabled}
            >
              <SliderControl
                id="barcode-margin-mm"
                label={isLabel ? "Inner margin" : "Page margin"}
                hint={
                  isLabel
                    ? "Label stock size is fixed; this pads content inside the die."
                    : "Non-printable area around the sheet edge."
                }
                value={config.marginMm}
                min={BARCODE_MARGIN_MM_MIN}
                max={BARCODE_MARGIN_MM_MAX}
                step={1}
                unit="mm"
                disabled={controlsDisabled}
                presets={BARCODE_MARGIN_PRESETS_MM}
                onChange={(marginMm) => onChange({ ...config, marginMm })}
              />
            </SetupRow>

            <SetupRow
              title={hints.brandBarcodeGap.title}
              description={hints.brandBarcodeGap.description}
              affects={hints.brandBarcodeGap.affects}
              highlight="knot"
              onHighlight={setHighlight}
              disabled={controlsDisabled}
            >
              <SliderControl
                id="barcode-brand-gap"
                label="KNOT to barcode"
                hint="Space between the KNOT brand line and the barcode block."
                value={config.brandBarcodeGapMm}
                min={BARCODE_TEXT_GAP_MM_MIN}
                max={BARCODE_TEXT_GAP_MM_MAX}
                step={1}
                unit="mm"
                disabled={controlsDisabled}
                presets={[2, 4, 6, 8, 10]}
                onChange={(brandBarcodeGapMm) => onChange({ ...config, brandBarcodeGapMm })}
              />
            </SetupRow>

            <SetupRow
              title={hints.textGap.title}
              description={hints.textGap.description}
              affects={hints.textGap.affects}
              disabled={controlsDisabled}
            >
              <SliderControl
                id="barcode-text-gap"
                label="Below barcode"
                hint="Gap between the barcode block, serial number, and series name."
                value={config.textGapMm}
                min={BARCODE_TEXT_GAP_MM_MIN}
                max={BARCODE_TEXT_GAP_MM_MAX}
                step={1}
                unit="mm"
                disabled={controlsDisabled}
                presets={[2, 4, 6, 8, 10]}
                onChange={(textGapMm) => onChange({ ...config, textGapMm })}
              />
            </SetupRow>
          </div>
        </SetupSection>

        <SetupSection
          title="Barcode scan quality"
          description="Tune bar dimensions for reliable scanning on your printer."
        >
          <SetupRow
            title={hints.barcode.title}
            description={hints.barcode.description}
            affects={hints.barcode.affects}
            highlight="barcode"
            onHighlight={setHighlight}
            disabled={controlsDisabled}
          >
            <div className="space-y-3">
              <SliderControl
                id="barcode-height"
                label="Bar height"
                hint="Taller bars scan more easily; keep within your label height."
                value={config.barcodeHeight}
                min={24}
                max={72}
                step={2}
                unit="px"
                disabled={controlsDisabled}
                onChange={(barcodeHeight) => onChange({ ...config, barcodeHeight })}
              />
              <SliderControl
                id="barcode-module-width"
                label="Bar thickness"
                hint="Thicker bars use more horizontal space (module width multiplier)."
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
            </div>
          </SetupRow>
        </SetupSection>
      </div>
    </div>
  );
}
