"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileText,
  History,
  Receipt,
  Search,
} from "lucide-react";
import * as React from "react";

import { searchEntities } from "@/app/actions/finder";
import type { FinderResult } from "@/lib/queries/finder";
import { getCommandGroups } from "@/lib/command-palette";
import { useKeyboardShortcut } from "@/lib/keyboard";
import { useFinderRecents } from "@/lib/use-finder-recents";
import { Role } from "@/lib/prisma-enums";
import { cn } from "@/lib/utils";

const KIND_ICONS = {
  purchaseRequest: FileText,
  purchaseOrder: ClipboardList,
  vendor: Building2,
  invoice: Receipt,
};

export function CommandPalette({
  open,
  onOpenChange,
  role,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
  onNavigate?: (href: string) => void;
}) {
  const router = useRouter();
  const groups = React.useMemo(() => getCommandGroups(role), [role]);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<FinderResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { recents, push: pushRecent, clear: clearRecents } = useFinderRecents();

  useKeyboardShortcut(
    "Escape",
    () => onOpenChange(false),
    { enabled: open, allowInInput: true },
  );

  // Debounced finder search
  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      searchEntities(trimmed)
        .then((rows) => {
          setResults(rows);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(handle);
  }, [open, query]);

  // Reset search when palette closes
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function navigate(href: string, entry?: FinderResult) {
    onOpenChange(false);
    if (entry) {
      pushRecent(entry);
    }
    if (onNavigate) {
      onNavigate(href);
    } else {
      router.push(href);
    }
  }

  const showResults = query.trim().length >= 2;
  const showRecents = !showResults && recents.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm animate-in fade-in-0"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <Command
        className={cn(
          "w-full max-w-[560px] overflow-hidden rounded-2xl border border-border-subtle bg-popover text-popover-foreground shadow-ds-3 animate-in fade-in-0 zoom-in-95",
        )}
        onClick={(e) => e.stopPropagation()}
        label="Finder"
        shouldFilter={!showResults}
      >
        <div className="flex items-center gap-2 border-b border-border-subtle px-3">
          <Search className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Find a PR, PO, vendor, invoice, or jump to a page…"
            className="h-12 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {loading ? (
            <span className="text-ds-2xs text-muted-foreground" aria-live="polite">
              Searching…
            </span>
          ) : null}
        </div>
        <Command.List className="max-h-[440px] overflow-y-auto p-1">
          <Command.Empty className="px-3 py-6 text-center text-ds-sm text-muted-foreground">
            {showResults ? "No matches found." : "Type to search."}
          </Command.Empty>

          {showResults && results.length > 0 ? (
            <Command.Group
              heading="Results"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {results.map((r) => {
                const Icon = KIND_ICONS[r.kind];
                return (
                  <Command.Item
                    key={`${r.kind}-${r.id}`}
                    value={`${r.kind} ${r.refLabel} ${r.title} ${r.subtitle}`}
                    onSelect={() => navigate(r.href, r)}
                    className="flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-3 text-ds-sm text-foreground aria-selected:bg-secondary"
                  >
                    <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                    <span className="flex-1 truncate">
                      <span className="font-medium">{r.title}</span>
                      <span className="ml-2 text-muted-foreground">{r.subtitle}</span>
                    </span>
                    <span className="font-mono text-ds-2xs text-muted-foreground">
                      {r.refLabel.length > 12 ? r.refLabel.slice(0, 12) + "…" : r.refLabel}
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" strokeWidth={1.5} />
                  </Command.Item>
                );
              })}
            </Command.Group>
          ) : null}

          {showRecents ? (
            <Command.Group
              heading="Recents"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {recents.map((r) => {
                const Icon = KIND_ICONS[r.kind] ?? History;
                return (
                  <Command.Item
                    key={`recent-${r.kind}-${r.id}`}
                    value={`${r.title} ${r.subtitle}`}
                    onSelect={() => navigate(r.href, r)}
                    className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 text-ds-sm text-foreground aria-selected:bg-secondary"
                  >
                    <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    <span className="flex-1 truncate">
                      <span className="font-medium">{r.title}</span>
                      <span className="ml-2 text-muted-foreground">{r.subtitle}</span>
                    </span>
                  </Command.Item>
                );
              })}
              <Command.Item
                value="clear recents"
                onSelect={() => clearRecents()}
                className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-3 text-ds-xs text-muted-foreground aria-selected:bg-secondary"
              >
                Clear recents
              </Command.Item>
            </Command.Group>
          ) : null}

          {!showResults
            ? groups.map((group) =>
                group.items.length === 0 ? null : (
                  <Command.Group
                    key={group.id}
                    heading={group.label}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Command.Item
                          key={item.id}
                          value={`${item.label} ${item.href ?? ""}`}
                          onSelect={() => {
                            if (item.href) {
                              navigate(item.href);
                            }
                          }}
                          className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 text-ds-sm text-foreground aria-selected:bg-secondary"
                        >
                          <Icon
                            className="size-3.5 text-muted-foreground"
                            strokeWidth={1.5}
                          />
                          <span className="flex-1">{item.label}</span>
                          {item.shortcut ? (
                            <kbd className="font-mono text-[11px] text-muted-foreground">
                              {item.shortcut}
                            </kbd>
                          ) : null}
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                ),
              )
            : null}
        </Command.List>
        <div className="border-t border-border-subtle px-3 py-2 text-ds-2xs text-muted-foreground">
          <span>
            <kbd className="font-mono">PR-</kbd>, <kbd className="font-mono">PO-</kbd>,{" "}
            <kbd className="font-mono">INV-</kbd> for quick jumps · <kbd className="font-mono">↵</kbd>{" "}
            open · <kbd className="font-mono">esc</kbd> close
          </span>
        </div>
      </Command>
    </div>
  );
}
