import { Skeleton } from "@/components/ui/skeleton";

/** Instant shell while auth + layout resolve — avoids blank screen on navigation. */
export function DashboardLayoutFallback() {
  return (
    <div className="flex min-h-screen bg-shell-gradient">
      <aside className="hidden w-sidebar shrink-0 border-r border-border-subtle md:flex md:flex-col">
        <div className="space-y-3 border-b border-border-subtle px-4 py-4">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <Skeleton className="mt-3 h-10 w-full rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="px-3 pt-3">
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
        <div className="flex flex-1 flex-col gap-2 px-3 py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-full" />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-8">
        <Skeleton className="mb-6 h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </main>
    </div>
  );
}
