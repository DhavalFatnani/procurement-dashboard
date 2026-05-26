"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  totalPages,
  hasNextPage,
  searchParams,
  pageParam = "page",
  onPageChange,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number | null;
  totalPages: number | null;
  hasNextPage?: boolean;
  searchParams: Record<string, string | undefined>;
  pageParam?: string;
  onPageChange?: (page: number) => void;
}) {
  const canNext = hasNextPage ?? (totalPages != null && page < totalPages);
  const effectiveTotalPages = totalPages ?? (canNext ? page + 1 : page);
  const exactTotal = total != null;

  if (effectiveTotalPages <= 1 && page === 1 && !canNext && (total === 0 || total == null)) {
    if (total === 0) {
      return null;
    }
  }

  const start = page === 1 && !exactTotal ? 1 : total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = exactTotal
    ? Math.min(page * pageSize, total)
    : (page - 1) * pageSize + pageSize;

  function hrefFor(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v) {
        params.set(k, v);
      }
    }
    params.set(pageParam, String(p));
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  function goToPage(p: number) {
    if (onPageChange) {
      onPageChange(p);
    }
  }

  const navClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1");

  const resultLabel = (() => {
    if (total === 0) {
      return "0 results";
    }
    if (exactTotal) {
      return (
        <>
          <span className="font-semibold text-foreground">
            {start.toLocaleString("en-IN")}–{end.toLocaleString("en-IN")}
          </span>{" "}
          of <span className="font-semibold text-foreground">{total.toLocaleString("en-IN")}</span>
        </>
      );
    }
    if (canNext) {
      return (
        <>
          <span className="font-semibold text-foreground">
            {start}–{end}+
          </span>{" "}
          results
        </>
      );
    }
    return `${start}–${end} results`;
  })();

  return (
    <nav
      className="flex items-center justify-between gap-2 text-ds-sm"
      aria-label="Pagination"
    >
      <span className="text-muted-foreground">{resultLabel}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          onPageChange ? (
            <button type="button" className={navClass} onClick={() => goToPage(page - 1)}>
              <ChevronLeft className="size-3.5" strokeWidth={1.5} />
              Previous
            </button>
          ) : (
            <Link href={hrefFor(page - 1)} className={navClass}>
              <ChevronLeft className="size-3.5" strokeWidth={1.5} />
              Previous
            </Link>
          )
        ) : (
          <span
            className={cn(navClass, "pointer-events-none opacity-40")}
            aria-disabled="true"
          >
            <ChevronLeft className="size-3.5" strokeWidth={1.5} />
            Previous
          </span>
        )}
        {canNext ? (
          onPageChange ? (
            <button type="button" className={navClass} onClick={() => goToPage(page + 1)}>
              Next
              <ChevronRight className="size-3.5" strokeWidth={1.5} />
            </button>
          ) : (
            <Link href={hrefFor(page + 1)} className={navClass}>
              Next
              <ChevronRight className="size-3.5" strokeWidth={1.5} />
            </Link>
          )
        ) : (
          <span
            className={cn(navClass, "pointer-events-none opacity-40")}
            aria-disabled="true"
          >
            Next
            <ChevronRight className="size-3.5" strokeWidth={1.5} />
          </span>
        )}
      </div>
    </nav>
  );
}
