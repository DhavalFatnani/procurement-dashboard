"use client";

import type { LabelTemplate } from "@/lib/label-template-types";
import {
  BARCODE_PAGE_SIZE_GROUPS,
  LABEL_SIZE_OPTIONS,
  labelDimensionsMatch,
} from "@/lib/label-studio-utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function LabelSizePicker({
  template,
  onChange,
  disabled,
}: {
  template: LabelTemplate;
  onChange: (template: LabelTemplate) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-5">
      {BARCODE_PAGE_SIZE_GROUPS.map((group) => {
        const options = LABEL_SIZE_OPTIONS.filter((o) => o.group === group.id);
        return (
          <div key={group.id}>
            <Label className="mb-2 block text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </Label>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
              {options.map((size) => {
                const active = labelDimensionsMatch(template.page, size);
                return (
                  <Button
                    key={size.id}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    disabled={disabled}
                    title={size.hint}
                    className={cn("h-auto min-h-8 whitespace-normal py-1.5 text-left")}
                    onClick={() =>
                      onChange({
                        ...template,
                        page: {
                          ...template.page,
                          widthMm: size.widthMm,
                          heightMm: size.heightMm,
                        },
                      })
                    }
                  >
                    {size.label}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
