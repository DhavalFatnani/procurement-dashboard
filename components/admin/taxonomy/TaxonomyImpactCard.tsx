"use client";

import Link from "next/link";

import { SurfaceCard, SurfaceCardDescription, SurfaceCardTitle } from "@/components/shared/SurfaceCard";
import type { TaxonomyImpact } from "@/lib/queries/taxonomy-impact";

export function TaxonomyImpactCard({ impact }: { impact: TaxonomyImpact }) {
  const catalogTotal =
    impact.catalogItems.active +
    impact.catalogItems.pending +
    impact.catalogItems.inactive +
    impact.catalogItems.rejected;

  return (
    <SurfaceCard className="space-y-4">
      <div>
        <SurfaceCardTitle>Impact summary</SurfaceCardTitle>
        <SurfaceCardDescription className="mt-1">
          Usage and guardrails before changing this node.
        </SurfaceCardDescription>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-ds-sm">
        <div>
          <dt className="text-ds-xs text-muted-foreground">Open purchase requests</dt>
          <dd className="font-medium tabular-nums">{impact.openPurchaseRequests}</dd>
        </div>
        <div>
          <dt className="text-ds-xs text-muted-foreground">PR line history</dt>
          <dd className="font-medium tabular-nums">{impact.purchaseRequestLines}</dd>
        </div>
        <div>
          <dt className="text-ds-xs text-muted-foreground">Serial reservations</dt>
          <dd className="font-medium tabular-nums">{impact.serialReservations}</dd>
        </div>
        <div>
          <dt className="text-ds-xs text-muted-foreground">Catalog items</dt>
          <dd className="font-medium tabular-nums">{catalogTotal}</dd>
          {catalogTotal > 0 ? (
            <p className="mt-0.5 text-ds-xs text-muted-foreground">
              {impact.catalogItems.active} active · {impact.catalogItems.pending} pending ·{" "}
              {impact.catalogItems.inactive} inactive
            </p>
          ) : null}
        </div>
        {impact.linkedSeries ? (
          <div>
            <dt className="text-ds-xs text-muted-foreground">Linked series</dt>
            <dd className="font-mono text-ds-xs">
              <Link
                href={`/admin/platform/series?code=${encodeURIComponent(impact.linkedSeries)}`}
                className="text-primary hover:underline"
              >
                {impact.linkedSeries}
              </Link>
            </dd>
          </div>
        ) : null}
      </dl>

      {impact.blockers.length > 0 ? (
        <div className="space-y-2">
          <p className="text-ds-xs font-medium text-muted-foreground uppercase tracking-wide">
            Blockers
          </p>
          <ul className="space-y-2">
            {impact.blockers.map((blocker) => (
              <li
                key={blocker.code}
                className="rounded-md border border-border-subtle bg-foreground/[0.02] px-3 py-2 text-ds-sm"
              >
                <p>{blocker.message}</p>
                {blocker.ids && blocker.ids.length > 0 ? (
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {blocker.code === "OPEN_PURCHASE_REQUESTS"
                      ? blocker.ids.map((id) => (
                          <li key={id}>
                            <Link
                              href={`/purchase-requests/${id}`}
                              className="font-mono text-ds-xs text-primary hover:underline"
                            >
                              PR {id.slice(0, 8)}…
                            </Link>
                          </li>
                        ))
                      : blocker.ids.slice(0, 5).map((id) => (
                          <li key={id} className="font-mono text-ds-xs text-muted-foreground">
                            {id.slice(0, 8)}…
                          </li>
                        ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-ds-sm text-muted-foreground">No blockers for standard ops actions.</p>
      )}
    </SurfaceCard>
  );
}
