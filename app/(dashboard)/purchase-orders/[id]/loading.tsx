import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrderDetailLoading() {
  return (
    <div className="page-stack">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="space-y-4 rounded-2xl border border-border-subtle bg-card p-5 shadow-ds surface-glow">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-3/4 max-w-md" />
            <Skeleton className="h-4 w-2/3 max-w-sm" />
            <div className="flex items-center gap-3 pt-1">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-card px-2 shadow-ds">
            <div className="flex h-10 items-center gap-2 px-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-20" />
              ))}
            </div>
          </div>
          <div className="section-stack">
            <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-ds">
              <Skeleton className="mb-3 h-4 w-32" />
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-ds">
              <Skeleton className="mb-3 h-4 w-24" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <SideSkeleton title="Progress" lines={6} />
          <SideSkeleton title="Closure checks" lines={4} />
          <SideSkeleton title="Next actions" lines={3} />
        </aside>
      </div>
    </div>
  );
}

function SideSkeleton({ title, lines }: { title: string; lines: number }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-card p-4 shadow-ds">
      <Skeleton className="mb-3 h-3 w-24" aria-label={`${title} skeleton`} />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
