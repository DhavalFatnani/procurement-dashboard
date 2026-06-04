import Link from "next/link";

import { EmptyState } from "@/components/shared/EmptyState";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { FINANCE_ROUTES } from "@/lib/finance-routes";
import { formatInr } from "@/lib/format-datetime";
import type { PaymentAgeingBucketSummary } from "@/lib/queries/dashboard";

const BUCKET_TONES = [
  "var(--status-success)",
  "var(--status-info)",
  "var(--status-warning)",
  "var(--status-error)",
] as const;

export function PaymentAgeingSummaryCard({
  buckets,
}: {
  buckets: PaymentAgeingBucketSummary[];
}) {
  const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
  const totalValue = buckets.reduce((sum, b) => sum + b.value, 0);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <SurfaceCard size="md" className="w-full flex-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <SurfaceCardTitle>Payment ageing</SurfaceCardTitle>
          <SurfaceCardDescription className="mt-1">
            Unpaid invoice balance by days open —{" "}
            <Link
              href="/reports?section=ageing"
              className="text-primary hover:underline"
            >
              full report
            </Link>
          </SurfaceCardDescription>
        </div>
        {totalCount > 0 ? (
          <p className="text-ds-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {totalCount}
            </span>{" "}
            open ·{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatInr(totalValue)}
            </span>
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        {totalCount === 0 ? (
          <EmptyState
            size="sm"
            variant="onboarding"
            title="No open invoices"
            description="Unpaid invoices will appear here by ageing bucket."
          />
        ) : (
          <ul className="space-y-3">
            {buckets.map((bucket, i) => {
              const pct = (bucket.count / maxCount) * 100;
              return (
                <li key={bucket.bucket}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-ds-xs">
                    <Link
                      href={`${FINANCE_ROUTES.invoiceSettlement}?paymentStatus=UNPAID`}
                      className="font-medium text-muted-foreground hover:text-foreground"
                    >
                      {bucket.bucket}
                    </Link>
                    <span className="tabular-nums text-foreground">
                      {bucket.count}
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatInr(bucket.value)}
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    aria-hidden
                  >
                    <div
                      className="h-full rounded-full transition-all duration-slow"
                      style={{
                        width: `${pct}%`,
                        background: BUCKET_TONES[i] ?? BUCKET_TONES[3],
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SurfaceCard>
  );
}
