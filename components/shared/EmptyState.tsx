import type { ReactNode } from "react";
import { AlertCircle, PackageOpen, SearchX, Sparkles, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const VARIANT_CONFIG = {
  default: {
    icon: PackageOpen,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  },
  onboarding: {
    icon: Sparkles,
    iconBg: "surface-accent-soft",
    iconColor: "text-[var(--brand-accent)]",
  },
  filtered: {
    icon: SearchX,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  },
  error: {
    icon: AlertCircle,
    iconBg: "bg-[var(--status-error-bg)]",
    iconColor: "text-[var(--status-error)]",
  },
} as const;

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  size = "default",
  variant = "default",
  steps,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "default";
  variant?: keyof typeof VARIANT_CONFIG;
  /** Optional numbered steps for onboarding-style empty states. */
  steps?: string[];
}) {
  const config = VARIANT_CONFIG[variant];
  const Icon = icon ?? config.icon;

  return (
    <div
      className={cn(
        "mx-auto flex flex-col items-center justify-center text-center",
        size === "sm" ? "max-w-xs px-6 py-8" : "max-w-sm px-6 py-16",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-2xl",
          config.iconBg,
          size === "sm" ? "size-10" : "size-14",
        )}
        aria-hidden
      >
        <Icon
          className={cn(config.iconColor, size === "sm" ? "size-5" : "size-6")}
          strokeWidth={1.5}
        />
      </span>
      <p
        className={cn(
          "mt-4 font-semibold text-foreground",
          size === "sm" ? "text-ds-sm" : "text-ds-base",
        )}
      >
        {title}
      </p>
      {description ? (
        <p className="mt-1 max-w-prose text-ds-sm leading-relaxed text-muted-foreground/80">
          {description}
        </p>
      ) : null}
      {steps && steps.length > 0 ? (
        <ol className="mt-4 w-full max-w-xs space-y-2 text-left text-ds-sm">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-2.5 text-muted-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-ds-2xs font-medium text-foreground">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
