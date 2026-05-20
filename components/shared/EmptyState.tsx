import type { ReactNode } from "react";
import { PackageOpen, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  icon: Icon = PackageOpen,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-w-xs flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-muted-foreground/80" strokeWidth={1.5} aria-hidden />
      <p className="mt-4 text-ds-base font-medium text-muted-foreground">{title}</p>
      {description ? (
        <p className="mt-1 text-ds-sm leading-relaxed text-muted-foreground/80">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
