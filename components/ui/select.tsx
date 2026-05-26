"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Radix-based Select primitive — modern, rounded-2xl, two sizes.
 *
 * Sizes:
 *   - `sm` — filter-bar / dense (h-8)
 *   - `md` — form fields (h-9, default)
 *
 * Items support an optional `description` slot rendered as a secondary line,
 * so vendor / PO pickers can show a subtitle inline.
 */

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const selectTriggerVariants = cva(
  cn(
    "group flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-input",
    "text-ds-sm text-foreground transition-[border,box-shadow,background-color] duration-fast outline-none",
    "placeholder:text-muted-foreground/70",
    "hover:border-border-strong hover:bg-secondary/40",
    "focus-visible:border-[var(--brand-accent)] focus-visible:shadow-ds-focus focus-visible:bg-input",
    "data-[state=open]:border-[var(--brand-accent)] data-[state=open]:shadow-ds-focus data-[state=open]:bg-input",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-background disabled:text-muted-foreground/50",
    "data-[placeholder]:text-muted-foreground/70",
    "aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_color-mix(in_srgb,var(--status-error)_28%,transparent)]",
    "[&>span]:line-clamp-1 [&>span]:flex-1 [&>span]:text-left",
  ),
  {
    variants: {
      size: {
        sm: "h-8 px-2.5",
        md: "h-9 px-3",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type SelectTriggerProps =
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> &
    VariantProps<typeof selectTriggerVariants>;

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, size, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(selectTriggerVariants({ size }), className)}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <span
        className={cn(
          "ml-1 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground",
          "transition-[background-color,color] duration-fast",
          "group-hover:bg-secondary/70 group-data-[state=open]:bg-secondary group-data-[state=open]:text-foreground",
        )}
        aria-hidden
      >
        <ChevronDown
          className="size-3.5 transition-transform duration-fast group-data-[state=open]:rotate-180"
          strokeWidth={1.75}
        />
      </span>
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1 text-muted-foreground",
      className,
    )}
    {...props}
  >
    <ChevronUp className="size-3.5" strokeWidth={1.5} />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1 text-muted-foreground",
      className,
    )}
    {...props}
  >
    <ChevronDown className="size-3.5" strokeWidth={1.5} />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn(
        "relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-xl border border-border-subtle bg-popover text-popover-foreground shadow-ds-3",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
        "data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
        position === "popper" &&
          "data-[side=bottom]:translate-y-0 data-[side=top]:-translate-y-0",
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1.5",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 pb-1 pt-1.5 text-ds-2xs font-semibold uppercase tracking-wide text-muted-foreground",
      className,
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export type SelectItemProps = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Item
> & {
  description?: React.ReactNode;
};

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, description, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-start gap-2 rounded-lg py-2 pl-8 pr-2 text-ds-sm text-foreground outline-none",
      "transition-colors duration-fast",
      "data-[highlighted]:bg-secondary data-[highlighted]:text-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "data-[state=checked]:font-medium",
      className,
    )}
    {...props}
  >
    <span className="pointer-events-none absolute left-2 top-2.5 flex size-3.5 items-center justify-center text-[var(--brand-accent)]">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <SelectPrimitive.ItemText asChild>
        <span className="truncate">{children}</span>
      </SelectPrimitive.ItemText>
      {description ? (
        <span className="truncate text-ds-xs text-muted-foreground">
          {description}
        </span>
      ) : null}
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border-subtle", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  selectTriggerVariants,
};
