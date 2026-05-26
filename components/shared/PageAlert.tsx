"use client";

import { AlertTriangle, Info, X, XCircle } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AlertVariant = "warning" | "error" | "info";

const variantStyles: Record<
  AlertVariant,
  { bar: string; border: string; icon: typeof AlertTriangle }
> = {
  warning: {
    bar: "bg-[var(--status-warning-bg)] border-b border-status-warning/40",
    border: "text-status-warning",
    icon: AlertTriangle,
  },
  error: {
    bar: "bg-[var(--status-error-bg)] border-b border-status-error/40",
    border: "text-status-error",
    icon: XCircle,
  },
  info: {
    bar: "bg-[var(--status-info-bg)] border-b border-status-info/40",
    border: "text-status-info",
    icon: Info,
  },
};

export function PageAlert({
  variant,
  children,
  dismissible,
  onDismiss,
  className,
}: {
  variant: AlertVariant;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}) {
  const [visible, setVisible] = React.useState(true);
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2.5 px-0 py-2 text-ds-sm text-foreground",
        styles.bar,
        className,
      )}
      role="alert"
    >
      <Icon className={cn("size-4 shrink-0", styles.border)} strokeWidth={1.5} />
      <div className="min-w-0 flex-1">{children}</div>
      {dismissible ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label="Dismiss"
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
        >
          <X className="size-4" strokeWidth={1.5} />
        </Button>
      ) : null}
    </div>
  );
}
