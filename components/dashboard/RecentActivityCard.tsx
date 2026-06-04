import Link from "next/link";
import {
  ClipboardList,
  FileText,
  PackageCheck,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Avatar } from "@/components/shared/Avatar";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  SurfaceCard,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import type { RecentActivityItem } from "@/lib/queries/dashboard-extras";

const KIND_ICONS: Record<RecentActivityItem["kind"], LucideIcon> = {
  pr: FileText,
  po: ClipboardList,
  grn: PackageCheck,
  invoice: Receipt,
  payment: Wallet,
};

export function RecentActivityCard({
  items,
  title = "Recent activity",
  emptyTitle = "No activity yet",
  emptyDescription = "Approvals and updates will appear here.",
}: {
  items: RecentActivityItem[];
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <SurfaceCard size="md" className="w-full flex-1">
      <SurfaceCardTitle>{title}</SurfaceCardTitle>
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            size="sm"
            variant="onboarding"
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = KIND_ICONS[item.kind];
              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex items-center gap-2.5 rounded-xl p-2 transition-colors duration-fast hover:bg-muted/60"
                >
                  <Avatar name={item.actor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={item.href}
                      className="block truncate text-ds-sm text-foreground hover:underline"
                    >
                      <span className="inline-flex items-center gap-1.5 align-middle">
                        <Icon
                          className="size-3 text-muted-foreground"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        {item.title}
                      </span>
                    </Link>
                    <p className="truncate text-ds-2xs text-muted-foreground">
                      {item.actor} · {formatDateTimeMedium(item.timestamp)}
                    </p>
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
