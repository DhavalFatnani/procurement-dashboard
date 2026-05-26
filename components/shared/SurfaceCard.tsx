import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const VARIANT_CLASS = {
  default:
    "border-border-subtle bg-card shadow-ds",
  interactive:
    "border-border-subtle bg-card shadow-ds cursor-pointer hover:border-border-default hover:shadow-ds-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995]",
  accent:
    "border-border-subtle bg-card shadow-ds surface-glow",
  ghost:
    "border-transparent bg-transparent shadow-none",
} as const;

const SIZE_CLASS = {
  sm: "rounded-xl p-3 gap-3",
  md: "rounded-2xl p-4 gap-4",
  lg: "rounded-2xl p-5 gap-5",
} as const;

export type SurfaceCardVariant = keyof typeof VARIANT_CLASS;
export type SurfaceCardSize = keyof typeof SIZE_CLASS;

export function SurfaceCard({
  variant = "default",
  size = "md",
  header,
  footer,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: SurfaceCardVariant;
  size?: SurfaceCardSize;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      data-surface-card
      data-variant={variant}
      data-size={size}
      className={cn(
        "flex flex-col overflow-hidden border text-ds-sm text-card-foreground",
        "transition-[background,border,box-shadow,transform] duration-fast ease-out",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      {header ? (
        <div className="flex flex-col gap-1 border-b border-border-subtle pb-3">{header}</div>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
      {footer ? (
        <div className="border-t border-border-subtle pt-3">{footer}</div>
      ) : null}
    </div>
  );
}

export function SurfaceCardTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-ds-md font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function SurfaceCardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-ds-xs text-muted-foreground", className)} {...props} />
  );
}
