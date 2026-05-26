import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-md border border-transparent bg-clip-padding text-ds-sm font-medium",
    "transition-[background,border,color,box-shadow,transform] duration-fast ease-out",
    "outline-none select-none",
    "focus-visible:shadow-ds-focus",
    "active:translate-y-px active:not-aria-[haspopup]:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-40",
    "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-ds hover:bg-[var(--accent-hover)] hover:shadow-ds-2",
        outline:
          "border-border bg-card text-foreground hover:bg-muted hover:border-border-strong aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary",
        ghost:
          "text-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "bg-[var(--status-error-bg)] text-[var(--status-error)] hover:bg-[color-mix(in_srgb,var(--status-error)_22%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--status-error)]/30",
        "destructive-solid":
          "bg-[var(--status-error-strong-bg)] text-[var(--text-on-status)] hover:bg-[var(--status-error)] shadow-ds",
        link: "text-primary underline-offset-4 hover:underline",
        soft:
          "bg-[color-mix(in_srgb,var(--brand-accent)_12%,transparent)] text-[var(--brand-accent)] hover:bg-[color-mix(in_srgb,var(--brand-accent)_18%,transparent)] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--brand-accent)_20%,transparent)]",
        gradient:
          "bg-accent-gradient text-primary-foreground shadow-ds hover:shadow-ds-2 hover:brightness-110",
      },
      size: {
        default: "h-8 px-3.5",
        xs: "h-6 rounded-sm px-2 text-ds-xs gap-1 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 rounded-sm px-2.5 text-ds-xs gap-1",
        lg: "h-9 rounded-md px-3.5",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-sm",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  loading,
  children,
  disabled,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  const content = loading ? (
    <>
      <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} aria-hidden />
      {children}
    </>
  ) : (
    children
  );

  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading ? "true" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      render={render}
      nativeButton={nativeButton ?? render == null}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
