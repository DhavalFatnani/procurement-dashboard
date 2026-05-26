"use client";

import { Check, ChevronDown, Plus, X } from "lucide-react";
import * as React from "react";

import type { CatalogItemOption } from "@/lib/queries/purchase-requests";
import { normalizeCatalogItemName } from "@/lib/catalog-items";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { selectTriggerVariants } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function catalogMatchesQuery(name: string, query: string): boolean {
  const n = normalizeCatalogItemName(name).toLowerCase();
  const q = normalizeCatalogItemName(query).toLowerCase();
  return n === q;
}

export function CatalogItemPicker({
  items,
  catalogItemId,
  proposedName,
  disabled,
  readOnly,
  placeholder = "Search catalog or add new…",
  ariaLabel = "Catalog item",
  onChange,
}: {
  items: CatalogItemOption[];
  catalogItemId?: string;
  proposedName?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  onChange: (value: {
    catalogItemId?: string;
    proposedName?: string;
  }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedCatalog = items.find((c) => c.id === catalogItemId);
  const isProposal = Boolean(proposedName?.trim()) && !catalogItemId;
  const displayName = isProposal
    ? normalizeCatalogItemName(proposedName!)
    : selectedCatalog
      ? selectedCatalog.sku
        ? `${selectedCatalog.name} (${selectedCatalog.sku})`
        : selectedCatalog.name
      : null;
  const hasValue = Boolean(displayName);

  const trimmedSearch = normalizeCatalogItemName(search);
  const canPropose =
    trimmedSearch.length >= 2 &&
    !items.some((c) => catalogMatchesQuery(c.name, trimmedSearch));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSearch("");
    }
  }

  function selectCatalog(id: string) {
    onChange({ catalogItemId: id, proposedName: undefined });
    setOpen(false);
    setSearch("");
  }

  function selectProposal(name: string) {
    onChange({ catalogItemId: undefined, proposedName: name });
    setOpen(false);
    setSearch("");
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange({ catalogItemId: undefined, proposedName: undefined });
  }

  if (readOnly) {
    return (
      <p className="text-ds-sm text-foreground">
        {displayName ?? "—"}
        {isProposal ? (
          <span className="ml-1.5 text-ds-xs text-muted-foreground">
            (pending Ops approval)
          </span>
        ) : null}
      </p>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(selectTriggerVariants({ size: "sm" }), "w-full")}
          data-state={open ? "open" : "closed"}
          data-placeholder={!hasValue ? "" : undefined}
        >
          <span
            className={cn(
              "line-clamp-1 text-left",
              !hasValue && "text-muted-foreground/70",
            )}
          >
            {displayName ?? placeholder}
          </span>
          <div className="ml-1 flex shrink-0 items-center gap-1">
            {hasValue && !disabled ? (
              <span
                role="button"
                aria-label="Clear item"
                tabIndex={-1}
                onClick={handleClear}
                className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-3" strokeWidth={2} aria-hidden />
              </span>
            ) : null}
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-md text-muted-foreground",
                open && "bg-secondary text-foreground",
              )}
              aria-hidden
            >
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-fast",
                  open && "rotate-180",
                )}
                strokeWidth={1.75}
              />
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
      >
        <Command
          filter={(itemValue, query, keywords) => {
            const haystack = `${itemValue} ${(keywords ?? []).join(" ")}`.toLowerCase();
            return haystack.includes(query.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Search catalog…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {trimmedSearch.length >= 2
                ? "No catalog match — add as new below."
                : "Type to search the catalog."}
            </CommandEmpty>
            <CommandGroup>
              {canPropose ? (
                <CommandItem
                  value={`add-${trimmedSearch}`}
                  onSelect={() => selectProposal(trimmedSearch)}
                  className="text-[var(--brand-accent)]"
                >
                  <span className="flex size-3.5 items-center justify-center">
                    <Plus className="size-3.5" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">
                      Add &ldquo;{trimmedSearch}&rdquo;
                    </span>
                    <span className="truncate text-ds-xs text-muted-foreground">
                      Sends to Ops for catalog approval
                    </span>
                  </span>
                </CommandItem>
              ) : null}
              {items.map((item) => {
                const isSelected = item.id === catalogItemId;
                const label = item.sku ? `${item.name} (${item.sku})` : item.name;
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.sku ?? ""}`}
                    keywords={[item.sku ?? "", item.unit]}
                    onSelect={() => selectCatalog(item.id)}
                  >
                    <span className="flex size-3.5 items-center justify-center text-[var(--brand-accent)]">
                      {isSelected ? (
                        <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
                      ) : null}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn("truncate", isSelected && "font-medium")}
                      >
                        {label}
                      </span>
                      <span className="truncate text-ds-xs text-muted-foreground">
                        {item.unit}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
