import Link from "next/link";
import {
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardList,
  FileText,
  Hash,
  Inbox,
  LayoutDashboard,
  PackageCheck,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { BreadcrumbIconId, BreadcrumbItem } from "@/lib/breadcrumbs";
import { cn } from "@/lib/utils";

export type { BreadcrumbIconId, BreadcrumbItem };

const BREADCRUMB_ICONS: Record<BreadcrumbIconId, LucideIcon> = {
  inbox: Inbox,
  dashboard: LayoutDashboard,
  purchaseRequests: FileText,
  purchaseOrders: ClipboardList,
  goodsReceipt: PackageCheck,
  invoices: Receipt,
  payments: Wallet,
  vendors: Building2,
  serialGovernance: Hash,
  reports: BarChart3,
};

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-ds-xs text-muted-foreground">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const Icon = item.icon ? BREADCRUMB_ICONS[item.icon] : null;
          const content: ReactNode = (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                item.mono && "font-mono",
                isLast && "text-foreground",
              )}
            >
              {Icon ? (
                <Icon className="size-3" strokeWidth={1.5} aria-hidden />
              ) : null}
              {item.label}
            </span>
          );
          return (
            <li key={`${i}-${item.label}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded px-1 py-0.5 transition-colors duration-fast hover:bg-muted hover:text-foreground"
                >
                  {content}
                </Link>
              ) : (
                <span className="px-1 py-0.5">{content}</span>
              )}
              {!isLast ? (
                <ChevronRight
                  className="size-3 shrink-0 text-muted-foreground/60"
                  strokeWidth={1.5}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
