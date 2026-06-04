import {
  ClipboardList,
  FileText,
  PackageCheck,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import {
  SurfaceCard,
  SurfaceCardDescription,
  SurfaceCardTitle,
} from "@/components/shared/SurfaceCard";
import { buildPOActivity, type POActivityEventKind } from "@/lib/po-activity";
import { formatDateTimeMedium } from "@/lib/format-datetime";
import type { PODetail } from "@/lib/queries/purchase-orders";

const ICON_BY_KIND: Record<POActivityEventKind, LucideIcon> = {
  po_created: ClipboardList,
  grn_received: PackageCheck,
  grn_exception_resolved: ShieldCheck,
  invoice_uploaded: FileText,
};

export function PODetailActivityTab({ po }: { po: PODetail }) {
  const events = buildPOActivity(po);

  if (events.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Events on this purchase order will appear here as they happen."
      />
    );
  }

  return (
    <SurfaceCard
      header={
        <>
          <SurfaceCardTitle>Activity</SurfaceCardTitle>
          <SurfaceCardDescription>
            Synthesised timeline from receipts, invoices, and exception
            resolutions on this PO. A full audit log is coming soon.
          </SurfaceCardDescription>
        </>
      }
    >
      <ol className="relative space-y-4 pl-4">
        <span
          className="absolute left-[7px] top-1 bottom-1 w-px bg-border-subtle"
          aria-hidden
        />
        {events.map((event) => {
          const Icon = ICON_BY_KIND[event.kind];
          return (
            <li key={event.id} className="relative flex items-start gap-3">
              <span
                className="absolute -left-4 mt-1 flex size-3.5 items-center justify-center rounded-full border-2 border-card bg-[var(--brand-accent)] text-[var(--text-on-accent)]"
                aria-hidden
              />
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Icon className="size-3.5" strokeWidth={1.5} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-ds-sm font-medium text-foreground">
                  {event.title}
                </span>
                {event.description ? (
                  <span className="text-ds-xs text-muted-foreground">
                    {event.description}
                  </span>
                ) : null}
                <span className="text-ds-2xs text-muted-foreground">
                  {formatDateTimeMedium(event.at)}
                  {event.byName ? ` · ${event.byName}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </SurfaceCard>
  );
}
