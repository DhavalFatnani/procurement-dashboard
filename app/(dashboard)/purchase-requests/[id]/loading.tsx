import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseRequestDetailLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border-subtle bg-bg-elevated p-5"
          >
            <Skeleton className="mb-4 h-4 w-32 bg-bg-hover" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-3 w-full bg-bg-hover" />
              <Skeleton className="h-3 w-3/4 bg-bg-hover" />
              <Skeleton className="h-3 w-1/2 bg-bg-hover" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-64 rounded-lg border border-border-subtle bg-bg-elevated p-5">
        <Skeleton className="mb-4 h-4 w-24 bg-bg-hover" />
        <Skeleton className="mb-3 h-8 w-full bg-bg-hover" />
        <Skeleton className="h-8 w-full bg-bg-hover" />
      </div>
    </div>
  );
}
