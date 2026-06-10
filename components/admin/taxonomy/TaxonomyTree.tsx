"use client";

import { ChevronDown, ChevronRight, FolderTree, Search } from "lucide-react";
import * as React from "react";

import { Chip } from "@/components/shared/Chip";
import { Input } from "@/components/ui/input";
import { TaxonomyStatus } from "@/lib/prisma-enums";
import type { TaxonomyTreeCategory } from "@/lib/queries/taxonomy";
import type { TaxonomyNodeRef } from "@/lib/taxonomy-node";
import { cn } from "@/lib/utils";

export function TaxonomyTree({
  categories,
  selected,
  onSelect,
}: {
  categories: TaxonomyTreeCategory[];
  selected: TaxonomyNodeRef | null;
  onSelect: (node: TaxonomyNodeRef) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  const normalizedQuery = query.trim().toLowerCase();

  React.useEffect(() => {
    if (!selected) return;
    if (selected.type === "subcategory" || selected.type === "item") {
      const parent = categories.find((c) =>
        c.subcategories.some((s) =>
          selected.type === "subcategory"
            ? s.id === selected.id
            : false,
        ),
      );
      if (parent) {
        setExpanded((prev) => new Set(prev).add(parent.id));
      }
    }
  }, [selected, categories]);

  function toggleCategory(categoryId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const filtered = React.useMemo(() => {
    if (!normalizedQuery) return categories;
    return categories
      .map((cat) => {
        const catMatch = cat.name.toLowerCase().includes(normalizedQuery);
        const subs = cat.subcategories.filter(
          (sub) =>
            catMatch || sub.name.toLowerCase().includes(normalizedQuery),
        );
        if (catMatch || subs.length > 0) {
          return { ...cat, subcategories: subs };
        }
        return null;
      })
      .filter((c): c is TaxonomyTreeCategory => c !== null);
  }, [categories, normalizedQuery]);

  return (
    <div className="flex h-full min-h-[480px] flex-col rounded-lg border border-border-subtle bg-card">
      <div className="border-b border-border-subtle p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search taxonomy…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-ds-sm text-muted-foreground">No matches.</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((cat) => {
              const isExpanded = expanded.has(cat.id) || Boolean(normalizedQuery);
              const selectedCategory = selected?.type === "category" && selected.id === cat.id;
              return (
                <li key={cat.id}>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.04]"
                      onClick={() => toggleCategory(cat.id)}
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" strokeWidth={1.5} />
                      ) : (
                        <ChevronRight className="size-4" strokeWidth={1.5} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect({ type: "category", id: cat.id })}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-ds-sm transition-colors",
                        selectedCategory
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-foreground/[0.04]",
                      )}
                    >
                      <FolderTree className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                      <span className="truncate font-medium">{cat.name}</span>
                      <Chip
                        tone={cat.status === TaxonomyStatus.ACTIVE ? "success" : "neutral"}
                        size="sm"
                      >
                        {cat.status === TaxonomyStatus.ACTIVE ? "Active" : "Inactive"}
                      </Chip>
                      {cat.pendingCatalogCount > 0 ? (
                        <Chip tone="warning" size="sm">
                          {cat.pendingCatalogCount} pending
                        </Chip>
                      ) : null}
                    </button>
                  </div>
                  {isExpanded ? (
                    <ul className="ml-7 border-l border-border-subtle/80 pl-2">
                      {cat.subcategories.map((sub) => {
                        const selectedSub =
                          selected?.type === "subcategory" && selected.id === sub.id;
                        return (
                          <li key={sub.id}>
                            <button
                              type="button"
                              onClick={() => onSelect({ type: "subcategory", id: sub.id })}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-ds-sm transition-colors",
                                selectedSub
                                  ? "bg-primary/10 text-foreground"
                                  : "hover:bg-foreground/[0.04]",
                              )}
                            >
                              <span className="truncate">{sub.name}</span>
                              <Chip
                                tone={sub.status === TaxonomyStatus.ACTIVE ? "success" : "neutral"}
                                size="sm"
                              >
                                {sub.status === TaxonomyStatus.ACTIVE ? "Active" : "Inactive"}
                              </Chip>
                              {sub.pendingCatalogCount > 0 ? (
                                <Chip tone="warning" size="sm">
                                  {sub.pendingCatalogCount}
                                </Chip>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
