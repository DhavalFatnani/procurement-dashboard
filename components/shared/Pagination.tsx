import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  totalPages,
  searchParams,
  pageParam = "page",
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
  pageParam?: string;
}) {
  if (totalPages <= 1 && total === 0) {
    return null;
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

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

  return (
    <nav
      className="flex items-center justify-between gap-2 text-ds-sm"
      aria-label="Pagination"
    >
      <span className="text-muted-foreground">
        {total === 0 ? "0 results" : `${start}–${end} of ${total} results`}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
          >
            Previous
          </Link>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none h-8 opacity-40",
            )}
          >
            Previous
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={hrefFor(page + 1)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
          >
            Next
          </Link>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none h-8 opacity-40",
            )}
          >
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
