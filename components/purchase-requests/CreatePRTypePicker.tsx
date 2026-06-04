"use client";

import { ExecutionType } from "@/lib/prisma-enums";
import { ClipboardList, Hash, Warehouse } from "lucide-react";
import type { ReactNode } from "react";

import { ExecutionTypeBadge } from "@/components/shared/ExecutionTypeBadge";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { Button } from "@/components/ui/button";
import type { WarehouseOption } from "@/lib/format-warehouse";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = [
  {
    id: "vendor" as const,
    executionType: ExecutionType.VENDOR_PURCHASE,
    title: "Vendor purchase",
    icon: ClipboardList,
    summary: "Buy goods or services from external vendors. Supports multiple line items in one request.",
    steps: [
      "Add category line items and quantities",
      "Ops Head creates a PO with pricing after approval",
      "Track GRN, invoice, and payment through fulfillment",
    ],
    cta: "Start vendor purchase",
  },
  {
    id: "print" as const,
    executionType: ExecutionType.INTERNAL_PRINT,
    title: "Internal print",
    icon: Hash,
    summary: "Reserve serial number batches for lock tags and print in-house — no purchase order chain.",
    steps: [
      "Choose a lock-tag subcategory",
      "Set quantity and warehouse",
      "Reserve a non-overlapping serial range instantly",
    ],
    cta: "Start internal print",
  },
] as const;

export function CreatePRTypePicker({
  warehouses,
  selectedWarehouseName,
  onSelectVendor,
  onSelectPrint,
  onCancel,
  warehouseField,
  className,
}: {
  warehouses: WarehouseOption[];
  selectedWarehouseName: string;
  onSelectVendor: () => void;
  onSelectPrint: () => void;
  onCancel?: () => void;
  /** When set, replaces the passive warehouse summary (Ops Head picker). */
  warehouseField?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-6", className)}>
      <div className="space-y-1">
        <p className="text-ds-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step 1 — Request type
        </p>
        <h2 className="text-ds-md font-semibold tracking-tight text-foreground">
          What are you requesting?
        </h2>
        <p className="max-w-2xl text-ds-sm text-muted-foreground">
          Vendor purchase and internal print follow different approval paths. Choose deliberately
          before entering line items — you can change type later, but it clears your draft.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const onSelect = option.id === "vendor" ? onSelectVendor : onSelectPrint;

          return (
            <SurfaceCard
              key={option.id}
              variant="interactive"
              size="lg"
              className="group h-full"
              onClick={onSelect}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={option.title}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--brand-accent)]">
                  <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                </div>
                <ExecutionTypeBadge type={option.executionType} />
              </div>

              <div className="mt-4 space-y-2">
                <SurfaceCardTitle>{option.title}</SurfaceCardTitle>
                <SurfaceCardDescription className="text-ds-sm leading-relaxed">
                  {option.summary}
                </SurfaceCardDescription>
              </div>

              <ul className="mt-4 space-y-2 text-ds-xs text-muted-foreground">
                {option.steps.map((step) => (
                  <li key={step} className="flex gap-2">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--brand-accent)]"
                      aria-hidden
                    />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect();
                  }}
                >
                  {option.cta}
                </Button>
              </div>
            </SurfaceCard>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 text-ds-sm">
          <Warehouse className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <div className="min-w-0 flex-1 space-y-2">
            {warehouseField ? (
              <>
                <p className="font-medium text-foreground">Warehouse for this request</p>
                {warehouseField}
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  {warehouses.length === 1
                    ? `Assigned warehouse: ${selectedWarehouseName}`
                    : `${warehouses.length} warehouses available`}
                </p>
                <p className="text-ds-xs text-muted-foreground">
                  {warehouses.length === 1
                    ? "This request will be scoped to your store."
                    : "You can pick the warehouse in the next step."}
                </p>
              </>
            )}
          </div>
        </div>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Keep current type
          </Button>
        ) : null}
      </div>
    </section>
  );
}
