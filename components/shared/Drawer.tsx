"use client";

import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { drawerSlide } from "@/lib/motion";
import { cn } from "@/lib/utils";

type DrawerWidth = "md" | "lg" | "xl";

const WIDTH_CLASS: Record<DrawerWidth, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-2xl",
};

type DrawerSide = "right" | "bottom";

type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** e.g. "Step 2 of 4" for multi-step forms. */
  stepIndicator?: React.ReactNode;
  headerActions?: React.ReactNode;
  fullPageHref?: string;
  side?: DrawerSide;
  width?: DrawerWidth;
  className?: string;
  children: React.ReactNode;
};

export function DrawerShell({
  open,
  onOpenChange,
  title,
  description,
  stepIndicator,
  headerActions,
  fullPageHref,
  side = "right",
  width = "lg",
  className,
  children,
}: BaseProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className={cn(
          "flex w-full flex-col gap-0 overflow-hidden p-0 bg-[var(--surface-2)]",
          side === "right" && WIDTH_CLASS[width],
          className,
        )}
      >
        <SheetHeader
          className={cn(
            "flex flex-row items-start justify-between gap-3 border-b border-border-subtle px-5 py-4",
            "surface-glass",
          )}
        >
          <div className="min-w-0 space-y-1">
            {stepIndicator ? (
              <p className="text-ds-2xs font-medium uppercase tracking-wide text-[var(--brand-accent)]">
                {stepIndicator}
              </p>
            ) : null}
            <SheetTitle className="truncate text-ds-lg font-semibold tracking-tight">
              {title}
            </SheetTitle>
            {description ? (
              <SheetDescription className="text-ds-sm text-muted-foreground">
                {description}
              </SheetDescription>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            {fullPageHref ? (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Open as full page"
                render={
                  <Link href={fullPageHref} onClick={() => onOpenChange(false)} />
                }
              >
                <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="size-3.5" strokeWidth={1.5} aria-hidden />
            </Button>
          </div>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function FormDrawer({
  footer,
  children,
  bodyClassName,
  ...rest
}: BaseProps & {
  footer?: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <DrawerShell {...rest}>
      <motion.div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          "bg-[linear-gradient(to_bottom,var(--surface-2),var(--surface-1))]",
        )}
        variants={drawerSlide}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <div
          className={cn(
            "flex-1 overflow-y-auto px-5 py-5 section-stack",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={cn(
              "flex shrink-0 items-center justify-end gap-2 border-t border-border-subtle px-5 py-3",
              "surface-glass",
            )}
          >
            {footer}
          </div>
        ) : null}
      </motion.div>
    </DrawerShell>
  );
}

export function DetailDrawer({
  children,
  bodyClassName,
  tabs,
  ...rest
}: BaseProps & {
  bodyClassName?: string;
  /** Optional tab strip below header for preview sections. */
  tabs?: React.ReactNode;
}) {
  return (
    <DrawerShell {...rest}>
      {tabs ? (
        <div className="border-b border-border-subtle px-5 py-2 surface-glass">{tabs}</div>
      ) : null}
      <motion.div
        className="flex-1 overflow-y-auto px-5 py-5 section-stack"
        variants={drawerSlide}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <div className={bodyClassName}>{children}</div>
      </motion.div>
    </DrawerShell>
  );
}
