import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_COLUMNS = [
  { id: "a", header: "ID", width: "w-20" },
  { id: "b", header: "Name", width: "w-32" },
  { id: "c", header: "Status", width: "w-24" },
  { id: "d", header: "Updated", width: "w-28" },
];

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <TableSkeleton columns={DEFAULT_COLUMNS} />
    </div>
  );
}
