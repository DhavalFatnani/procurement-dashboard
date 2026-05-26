import { Skeleton } from "@/components/ui/skeleton";

export default function PrintPurchaseRequestLoading() {
  return (
    <div className="space-y-6 p-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="min-h-[600px] w-full max-w-3xl rounded-lg" />
    </div>
  );
}
