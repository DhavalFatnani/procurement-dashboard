import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewPurchaseRequestLoading() {
  return (
    <div className="space-y-6 p-8">
      <PageTableLoading columns={1} rows={0} />
      <Skeleton className="h-96 w-full max-w-3xl rounded-lg" />
    </div>
  );
}
