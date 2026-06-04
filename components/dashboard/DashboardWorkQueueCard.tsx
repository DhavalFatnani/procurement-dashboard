import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Chip } from "@/components/shared/Chip";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import type { DashboardWorkQueueItem } from "@/lib/queries/dashboard-extras";

export function DashboardWorkQueueCard({
  title,
  description,
  items,
  viewAllHref,
  viewAllLabel = "View all",
}: {
  title: string;
  description?: string;
  items: DashboardWorkQueueItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  return (
    <SurfaceCard size="md" className="w-full flex-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <SurfaceCardTitle>{title}</SurfaceCardTitle>
          {description ? (
            <SurfaceCardDescription className="mt-1">{description}</SurfaceCardDescription>
          ) : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="inline-flex shrink-0 items-center gap-1 text-ds-xs text-primary hover:underline"
          >
            {viewAllLabel}
            <ArrowRight className="size-3" strokeWidth={1.5} aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            size="sm"
            variant="onboarding"
            title="Nothing queued"
            description="Actionable items will show up here as work comes in."
          />
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ds-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="truncate text-ds-2xs text-muted-foreground">
                      {item.subtitle}
                    </p>
                  </div>
                  {item.badge ? (
                    <Chip tone="neutral" size="sm" variant="soft">
                      {item.badge}
                    </Chip>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SurfaceCard>
  );
}
