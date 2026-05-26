import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/shared/TableSkeleton";

const PO_COLUMNS = [
  { id: "id", header: "PO", width: "w-24" },
  { id: "status", header: "Status", width: "w-20" },
  { id: "value", header: "Value", width: "w-20" },
];

export default function VendorDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5">
          <Skeleton className="mb-4 h-4 w-28" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5">
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <TableSkeleton columns={PO_COLUMNS} rows={5} />
    </div>
  );
}
