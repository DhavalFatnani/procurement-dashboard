import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonMetrics({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border-subtle bg-bg-elevated p-5"
        >
          <Skeleton className="mb-3 h-3 w-20 bg-bg-hover" />
          <Skeleton className="mb-2 h-6 w-16 bg-bg-hover" />
          <Skeleton className="h-3 w-28 bg-bg-hover" />
        </div>
      ))}
    </div>
  );
}
