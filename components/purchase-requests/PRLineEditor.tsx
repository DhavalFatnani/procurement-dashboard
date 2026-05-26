"use client";

import { ExecutionType } from "@prisma/client";
import * as React from "react";

import type { PRLineInput } from "@/app/actions/purchase-requests";
import type { CategoryOption, SubcategoryOption } from "@/lib/queries/purchase-requests";
import { MAX_PR_LINES } from "@/lib/purchase-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PRLineDraft = PRLineInput & { key: string };

export function emptyLineDraft(): PRLineDraft {
  return {
    key: crypto.randomUUID(),
    categoryId: "",
    subcategoryId: "",
    quantity: 1,
  };
}

export function linesFromDetail(
  lines: {
    categoryId: string;
    subcategoryId: string;
    quantity: number;
    notes?: string | null;
  }[],
): PRLineDraft[] {
  if (lines.length === 0) {
    return [emptyLineDraft()];
  }
  return lines.map((line) => ({
    key: crypto.randomUUID(),
    categoryId: line.categoryId,
    subcategoryId: line.subcategoryId,
    quantity: line.quantity,
    notes: line.notes ?? undefined,
  }));
}

export function toLineInputs(drafts: PRLineDraft[]): PRLineInput[] {
  return drafts.map(({ categoryId, subcategoryId, quantity, notes }) => ({
    categoryId,
    subcategoryId,
    quantity,
    notes,
  }));
}

export function PRLineEditor({
  categories,
  subcategories,
  lines,
  onChange,
  vendorPurchaseOnly = true,
  readOnly = false,
}: {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  lines: PRLineDraft[];
  onChange: (lines: PRLineDraft[]) => void;
  vendorPurchaseOnly?: boolean;
  readOnly?: boolean;
}) {
  const vendorSubs = React.useMemo(
    () =>
      vendorPurchaseOnly
        ? subcategories.filter((s) => s.executionType === ExecutionType.VENDOR_PURCHASE)
        : subcategories,
    [subcategories, vendorPurchaseOnly],
  );

  function updateLine(index: number, patch: Partial<PRLineDraft>) {
    const next = lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
    onChange(next);
  }

  function addLine() {
    if (lines.length >= MAX_PR_LINES) {
      return;
    }
    onChange([...lines, emptyLineDraft()]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) {
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const subsForCategory = vendorSubs.filter((s) => s.categoryId === line.categoryId);
        return (
          <div
            key={line.key}
            className="grid gap-3 rounded-lg border border-border-subtle bg-muted/10 p-3 sm:grid-cols-[1fr_1fr_100px_auto]"
          >
            <div className="space-y-1.5">
              <label className="text-ds-xs font-medium text-muted-foreground">
                Line {index + 1} · Category
              </label>
              <Select
                value={line.categoryId}
                onValueChange={(value) =>
                  updateLine(index, { categoryId: value, subcategoryId: "" })
                }
                disabled={readOnly}
              >
                <SelectTrigger size="sm" aria-label="Category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-ds-xs font-medium text-muted-foreground">Subcategory</label>
              <Select
                value={line.subcategoryId}
                onValueChange={(value) => updateLine(index, { subcategoryId: value })}
                disabled={readOnly || !line.categoryId}
              >
                <SelectTrigger size="sm" aria-label="Subcategory">
                  <SelectValue placeholder="Select subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {subsForCategory.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-ds-xs font-medium text-muted-foreground">Qty</label>
              <Input
                type="number"
                min={1}
                value={line.quantity}
                disabled={readOnly}
                onChange={(e) =>
                  updateLine(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                }
                className="h-8"
              />
            </div>
            {!readOnly && lines.length > 1 ? (
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeLine(index)}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
      {!readOnly && lines.length < MAX_PR_LINES ? (
        <Button type="button" variant="outline" size="sm" onClick={() => addLine()}>
          + Add line
        </Button>
      ) : null}
    </div>
  );
}
