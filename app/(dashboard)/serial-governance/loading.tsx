import { PageTableLoading } from "@/components/shared/PageTableLoading";
import { SkeletonMetrics } from "@/components/shared/SkeletonMetrics";

export default function SerialGovernanceLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
      <SkeletonMetrics count={3} />
      <PageTableLoading columns={8} rows={6} />
    </div>
  );
}
