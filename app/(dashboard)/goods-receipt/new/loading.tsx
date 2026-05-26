import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewGoodsReceiptLoading() {
  return (
    <div className="space-y-6 p-8">
      <PageTableLoading columns={1} rows={0} />
      <Skeleton className="h-64 w-full max-w-2xl rounded-lg" />
      <Skeleton className="h-48 w-full max-w-2xl rounded-lg" />
    </div>
  );
}
