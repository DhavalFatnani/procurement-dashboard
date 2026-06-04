import { Skeleton } from "@/components/ui/skeleton";

export default function NewGoodsReceiptLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="rounded-2xl border border-border-subtle bg-card shadow-ds">
          <div className="border-b border-border-subtle px-6 py-4">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="space-y-4 p-6">
            <Skeleton className="h-4 w-64" />
            <div className="rounded-lg border border-border-subtle bg-muted/30 p-4 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-card shadow-ds">
          <div className="border-b border-border-subtle px-6 py-4">
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="space-y-4 p-6">
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={i}
                className="space-y-3 rounded-lg border border-border-subtle p-3"
              >
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-9 max-w-[10rem]" />
              </div>
            ))}
            <Skeleton className="h-9 max-w-[200px]" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
