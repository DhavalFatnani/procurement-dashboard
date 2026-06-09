"use client";

import { ExecutionType } from "@/lib/prisma-enums";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";

import type { PRLineInput } from "@/lib/pr-line-persistence";
import type { CatalogItemOption, SubcategoryOption } from "@/lib/queries/purchase-requests";
import { Chip } from "@/components/shared/Chip";
import {
  categoryById,
  categoryNameById,
  usesCatalogItemAtomicity,
  usesSubcategoryAtomicity,
} from "@/lib/catalog-atomicity";
import type { CategoryBillingGranularity } from "@/lib/prisma-enums";
import { MAX_ITEMS_PER_PR_LINE } from "@/lib/catalog-items";
import { MAX_PR_LINES } from "@/lib/purchase-lines";
import { Button } from "@/components/ui/button";
import { CatalogItemPicker } from "@/components/purchase-requests/CatalogItemPicker";
import { QuantityInput } from "@/components/shared/QuantityInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type PRLineItemDraft = {
  key: string;
  catalogItemId?: string;
  proposedName?: string;
  quantity: number;
};

export type PRLineDraft = {
  key: string;
  categoryId: string;
  subcategoryId: string;
  quantity: number;
  notes?: string;
  items: PRLineItemDraft[];
};

export function emptyLineDraft(vendorMode = true): PRLineDraft {
  return {
    key: crypto.randomUUID(),
    categoryId: "",
    subcategoryId: "",
    quantity: 1,
    items: [],
  };
}

export function linesFromDetail(
  lines: {
    categoryId: string;
    categoryName: string;
    billingGranularity: CategoryBillingGranularity;
    subcategoryId: string;
    quantity: number;
    notes?: string | null;
    items?: {
      catalogItemId: string;
      itemName: string;
      quantity: number;
    }[];
  }[],
  vendorMode = true,
): PRLineDraft[] {
  if (lines.length === 0) {
    return [emptyLineDraft(vendorMode)];
  }
  return lines.map((line) => {
    const subcategoryOnly =
      vendorMode &&
      usesSubcategoryAtomicity({ billingGranularity: line.billingGranularity });

    if (subcategoryOnly) {
      return {
        key: crypto.randomUUID(),
        categoryId: line.categoryId,
        subcategoryId: line.subcategoryId,
        quantity: line.quantity,
        notes: line.notes ?? undefined,
        items: [],
      };
    }

    return {
      key: crypto.randomUUID(),
      categoryId: line.categoryId,
      subcategoryId: line.subcategoryId,
      quantity: line.quantity,
      notes: line.notes ?? undefined,
      items:
        line.items && line.items.length > 0
          ? line.items.map((item) => ({
              key: crypto.randomUUID(),
              catalogItemId: item.catalogItemId,
              quantity: item.quantity,
            }))
          : vendorMode &&
              usesCatalogItemAtomicity({ billingGranularity: line.billingGranularity })
            ? [{ key: crypto.randomUUID(), quantity: 1 }]
            : [],
    };
  });
}

export function toLineInputs(
  drafts: PRLineDraft[],
  categories: { id: string; name: string; billingGranularity: CategoryBillingGranularity }[],
  vendorMode = true,
): PRLineInput[] {
  return drafts.map(({ categoryId, subcategoryId, quantity, notes, items }) => {
    if (vendorMode) {
      const category = categoryById(categoryId, categories);
      if (category && usesSubcategoryAtomicity(category)) {
        return {
          categoryId,
          subcategoryId,
          notes,
          quantity,
        };
      }
      return {
        categoryId,
        subcategoryId,
        notes,
        items: items.map((item) => ({
          catalogItemId: item.catalogItemId,
          proposedName: item.proposedName?.trim() || undefined,
          quantity: item.quantity,
        })),
      };
    }
    return {
      categoryId,
      subcategoryId,
      quantity,
      notes,
    };
  });
}

function fieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-ds-xs font-medium text-muted-foreground">{children}</label>
  );
}

function LineCard({
  lineIndex,
  modeLabel,
  modeTone,
  canRemove,
  readOnly,
  onRemove,
  children,
}: {
  lineIndex: number;
  modeLabel: string;
  modeTone: "neutral" | "info";
  canRemove: boolean;
  readOnly: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-border-subtle bg-card shadow-ds-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle bg-muted/25 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-ds-sm font-semibold text-foreground">
            Line {lineIndex + 1}
          </span>
          <Chip tone={modeTone} size="sm" variant="soft">
            {modeLabel}
          </Chip>
        </div>
        {canRemove && !readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden />
            Remove
          </Button>
        ) : null}
      </header>
      <div className="space-y-4 p-3 sm:p-4">{children}</div>
    </article>
  );
}

function CategorySubcategoryRow({
  line,
  lineIndex,
  categories,
  subsForCategory,
  readOnly,
  onCategoryChange,
  onSubcategoryChange,
  quantity,
  onQuantityChange,
}: {
  line: PRLineDraft;
  lineIndex: number;
  categories: { id: string; name: string; billingGranularity: CategoryBillingGranularity }[];
  subsForCategory: SubcategoryOption[];
  readOnly: boolean;
  onCategoryChange: (categoryId: string) => void;
  onSubcategoryChange: (subcategoryId: string) => void;
  quantity?: number;
  onQuantityChange?: (quantity: number) => void;
}) {
  const showQuantity = quantity !== undefined && onQuantityChange !== undefined;

  return (
    <div
      className={cn(
        "grid items-end gap-2 sm:gap-3",
        showQuantity
          ? "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(5.5rem,7.5rem)]"
          : "sm:grid-cols-2",
      )}
    >
      <div className="space-y-1.5">
        {fieldLabel({ children: "Category" })}
        <Select
          value={line.categoryId}
          onValueChange={onCategoryChange}
          disabled={readOnly}
        >
          <SelectTrigger size="sm" aria-label={`Line ${lineIndex + 1} category`}>
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
        {fieldLabel({ children: "Subcategory" })}
        <Select
          value={line.subcategoryId}
          onValueChange={onSubcategoryChange}
          disabled={readOnly || !line.categoryId}
        >
          <SelectTrigger size="sm" aria-label={`Line ${lineIndex + 1} subcategory`}>
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
      {showQuantity ? (
        <div className="space-y-1.5">
          {fieldLabel({ children: "Qty" })}
          <QuantityInput
            value={quantity}
            disabled={readOnly}
            onChange={onQuantityChange}
            size="sm"
            aria-label={`Line ${lineIndex + 1} quantity`}
          />
        </div>
      ) : null}
    </div>
  );
}

export function PRLineEditor({
  categories,
  subcategories,
  catalogItems,
  lines,
  onChange,
  vendorPurchaseOnly = true,
  readOnly = false,
}: {
  categories: { id: string; name: string; billingGranularity: CategoryBillingGranularity }[];
  subcategories: SubcategoryOption[];
  catalogItems: CatalogItemOption[];
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

  function updateItem(lineIndex: number, itemIndex: number, patch: Partial<PRLineItemDraft>) {
    const line = lines[lineIndex]!;
    const items = line.items.map((item, i) =>
      i === itemIndex ? { ...item, ...patch } : item,
    );
    updateLine(lineIndex, { items });
  }

  function addLine() {
    if (lines.length >= MAX_PR_LINES) {
      return;
    }
    onChange([...lines, emptyLineDraft(vendorPurchaseOnly)]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) {
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  }

  function addItem(lineIndex: number) {
    const line = lines[lineIndex]!;
    if (line.items.length >= MAX_ITEMS_PER_PR_LINE) {
      return;
    }
    updateLine(lineIndex, {
      items: [...line.items, { key: crypto.randomUUID(), quantity: 1 }],
    });
  }

  function removeItem(lineIndex: number, itemIndex: number) {
    const line = lines[lineIndex]!;
    if (line.items.length <= 1) {
      return;
    }
    updateLine(lineIndex, {
      items: line.items.filter((_, i) => i !== itemIndex),
    });
  }

  if (!vendorPurchaseOnly) {
    return (
      <div className="space-y-3">
        {lines.map((line, index) => {
          const subsForCategory = vendorSubs.filter((s) => s.categoryId === line.categoryId);
          return (
            <LineCard
              key={line.key}
              lineIndex={index}
              modeLabel="Internal print"
              modeTone="neutral"
              canRemove={lines.length > 1}
              readOnly={readOnly}
              onRemove={() => removeLine(index)}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(5.5rem,7.5rem)]">
                <div className="space-y-1.5 sm:col-span-1">
                  {fieldLabel({ children: "Category" })}
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
                  {fieldLabel({ children: "Subcategory" })}
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
                  {fieldLabel({ children: "Qty" })}
                  <QuantityInput
                    value={line.quantity}
                    disabled={readOnly}
                    onChange={(q) => updateLine(index, { quantity: q })}
                    size="sm"
                    aria-label={`Line ${index + 1} quantity`}
                  />
                </div>
              </div>
            </LineCard>
          );
        })}
      </div>
    );
  }

  const canRemoveLine = !readOnly && lines.length > 1;

  return (
    <div className="space-y-3">
      {lines.map((line, lineIndex) => {
        const category = categoryById(line.categoryId, categories);
        const subcategoryOnly = category ? usesSubcategoryAtomicity(category) : false;
        const catalogLine = category ? usesCatalogItemAtomicity(category) : false;
        const subsForCategory = vendorSubs.filter((s) => s.categoryId === line.categoryId);
        const catalogForSub = catalogItems.filter((c) => c.subcategoryId === line.subcategoryId);
        if (subcategoryOnly) {
          return (
            <LineCard
              key={line.key}
              lineIndex={lineIndex}
              modeLabel="Qty per subcategory"
              modeTone="neutral"
              canRemove={canRemoveLine}
              readOnly={readOnly}
              onRemove={() => removeLine(lineIndex)}
            >
              <CategorySubcategoryRow
                line={line}
                lineIndex={lineIndex}
                categories={categories}
                subsForCategory={subsForCategory}
                readOnly={readOnly}
                quantity={line.quantity}
                onQuantityChange={(q) => updateLine(lineIndex, { quantity: q })}
                onCategoryChange={(value) =>
                  updateLine(lineIndex, {
                    categoryId: value,
                    subcategoryId: "",
                    quantity: 1,
                    items: [],
                  })
                }
                onSubcategoryChange={(value) => updateLine(lineIndex, { subcategoryId: value })}
              />
            </LineCard>
          );
        }

        return (
          <LineCard
            key={line.key}
            lineIndex={lineIndex}
            modeLabel="Catalog items"
            modeTone="info"
            canRemove={canRemoveLine}
            readOnly={readOnly}
            onRemove={() => removeLine(lineIndex)}
          >
            <CategorySubcategoryRow
              line={line}
              lineIndex={lineIndex}
              categories={categories}
              subsForCategory={subsForCategory}
              readOnly={readOnly}
              onCategoryChange={(value) => {
                const nextCategory = categoryById(value, categories);
                updateLine(lineIndex, {
                  categoryId: value,
                  subcategoryId: "",
                  quantity: 1,
                  items:
                    nextCategory && usesCatalogItemAtomicity(nextCategory)
                      ? [{ key: crypto.randomUUID(), quantity: 1 }]
                      : [],
                });
              }}
              onSubcategoryChange={(value) =>
                updateLine(lineIndex, {
                  subcategoryId: value,
                  items: catalogLine
                    ? [{ key: crypto.randomUUID(), quantity: 1 }]
                    : [],
                })
              }
            />

            <div className="overflow-hidden rounded-md border border-border-subtle">
              <div className="hidden border-b border-border-subtle bg-muted/20 px-3 py-2 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(5.5rem,7.5rem)_2.25rem] sm:gap-3 sm:text-ds-xs sm:font-medium sm:text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span className="sr-only">Actions</span>
              </div>

              <ul className="divide-y divide-border-subtle">
                {line.items.map((item, itemIndex) => (
                    <li
                      key={item.key}
                      className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(5.5rem,7.5rem)_2.25rem] sm:items-end sm:gap-3"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <span className="text-ds-xs font-medium text-muted-foreground sm:sr-only">
                          {`Item ${itemIndex + 1}`}
                        </span>
                        <CatalogItemPicker
                          items={catalogForSub}
                          catalogItemId={item.catalogItemId}
                          proposedName={item.proposedName}
                          readOnly={readOnly}
                          disabled={!line.subcategoryId}
                          placeholder={
                            line.subcategoryId
                              ? "Search catalog or add new…"
                              : "Select subcategory first"
                          }
                          ariaLabel={`Line ${lineIndex + 1} item ${itemIndex + 1}`}
                          onChange={(value) =>
                            updateItem(lineIndex, itemIndex, value)
                          }
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-0">
                        <span className="text-ds-xs font-medium text-muted-foreground sm:sr-only">
                          Qty
                        </span>
                        <QuantityInput
                          value={item.quantity}
                          disabled={readOnly}
                          onChange={(q) =>
                            updateItem(lineIndex, itemIndex, { quantity: q })
                          }
                          size="sm"
                          aria-label={`Line ${lineIndex + 1} item ${itemIndex + 1} quantity`}
                        />
                      </div>

                      <div className="flex items-end justify-end sm:justify-center">
                        {!readOnly && line.items.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove item ${itemIndex + 1}`}
                            onClick={() => removeItem(lineIndex, itemIndex)}
                          >
                            <Trash2 className="size-4" strokeWidth={1.5} />
                          </Button>
                        ) : (
                          <span className="hidden h-8 sm:block" aria-hidden />
                        )}
                      </div>
                    </li>
                ))}
              </ul>

              {!readOnly && line.subcategoryId && line.items.length < MAX_ITEMS_PER_PR_LINE ? (
                <div className="border-t border-border-subtle bg-muted/15 px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-ds-xs"
                    onClick={() => addItem(lineIndex)}
                  >
                    <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
                    Add another item
                  </Button>
                </div>
              ) : null}
            </div>
          </LineCard>
        );
      })}

      {!readOnly && lines.length < MAX_PR_LINES ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5 sm:w-auto"
          onClick={() => addLine()}
        >
          <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
          Add line
        </Button>
      ) : null}
    </div>
  );
}
