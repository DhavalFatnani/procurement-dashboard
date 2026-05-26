import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function PageTableLoading({
  columns,
  rows = 10,
}: {
  columns: number;
  rows?: number;
}) {
  const tableColumns = Array.from({ length: columns }).map((_, i) => ({
    id: `col-${i}`,
    header: "",
    width: i === 0 ? "w-20" : "w-28",
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 max-w-md w-full" />
      </div>
      <TableSkeleton columns={tableColumns} rows={rows} />
    </div>
  );
}
