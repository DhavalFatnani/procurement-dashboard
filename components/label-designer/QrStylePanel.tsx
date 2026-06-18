"use client";

import type { QrStyle } from "@/lib/label-template-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function QrStylePanel({
  style,
  onChange,
  disabled,
}: {
  style: QrStyle;
  onChange: (style: QrStyle) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="qr-ec">Error correction</Label>
        <Select
          value={style.errorCorrection}
          disabled={disabled}
          onValueChange={(value) =>
            onChange({ ...style, errorCorrection: value as QrStyle["errorCorrection"] })
          }
        >
          <SelectTrigger id="qr-ec">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["L", "M", "Q", "H"] as const).map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qr-fg">Foreground</Label>
          <Input
            id="qr-fg"
            type="color"
            value={style.foreground}
            disabled={disabled}
            onChange={(e) => onChange({ ...style, foreground: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qr-bg">Background</Label>
          <Input
            id="qr-bg"
            type="color"
            value={style.background}
            disabled={disabled}
            onChange={(e) => onChange({ ...style, background: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="qr-quiet">Quiet zone (mm)</Label>
        <Input
          id="qr-quiet"
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={style.quietZoneMm}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...style, quietZoneMm: Number.parseFloat(e.target.value) || 0 })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="qr-scale">Module scale</Label>
        <Input
          id="qr-scale"
          type="number"
          min={0.5}
          max={4}
          step={0.1}
          value={style.moduleScale}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...style, moduleScale: Number.parseFloat(e.target.value) || 1 })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="qr-logo">Center logo URL (optional)</Label>
        <Input
          id="qr-logo"
          type="url"
          placeholder="https://..."
          value={style.logoUrl ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...style, logoUrl: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
