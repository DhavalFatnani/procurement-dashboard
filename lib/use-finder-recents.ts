"use client";

import * as React from "react";

import type { FinderResult } from "@/lib/queries/finder";

const STORAGE_KEY = "knot:finder:recents";
const MAX_RECENTS = 5;

type RecentEntry = Pick<FinderResult, "id" | "kind" | "title" | "subtitle" | "href" | "refLabel">;

function readStorage(): RecentEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function writeStorage(entries: RecentEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function useFinderRecents() {
  const [recents, setRecents] = React.useState<RecentEntry[]>([]);

  React.useEffect(() => {
    setRecents(readStorage());
  }, []);

  const push = React.useCallback((entry: RecentEntry) => {
    setRecents((current) => {
      const filtered = current.filter(
        (e) => !(e.kind === entry.kind && e.id === entry.id),
      );
      const next = [entry, ...filtered].slice(0, MAX_RECENTS);
      writeStorage(next);
      return next;
    });
  }, []);

  const clear = React.useCallback(() => {
    writeStorage([]);
    setRecents([]);
  }, []);

  return { recents, push, clear };
}
