"use client";

import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { fadeRise } from "@/lib/motion";

export function ActionCard({
  href,
  label,
  description,
  icon: Icon,
  className,
  animated = true,
}: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  className?: string;
  animated?: boolean;
}) {
  const content = (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-border-subtle bg-card p-4 shadow-ds",
        "transition-[background,border,box-shadow,transform] duration-fast ease-out",
        "hover:border-border-default hover:shadow-ds-2 hover:-translate-y-0.5",
        "active:translate-y-0 active:scale-[0.995]",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl",
          "bg-[color-mix(in_srgb,var(--brand-accent)_12%,transparent)]",
          "text-[var(--brand-accent)]",
          "transition-transform duration-fast group-hover:scale-105",
        )}
        aria-hidden
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-ds-sm font-semibold text-foreground">{label}</p>
          <p className="text-ds-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <ArrowRight
          className="size-4 shrink-0 translate-x-0 text-muted-foreground opacity-0 transition-all duration-fast group-hover:translate-x-0.5 group-hover:opacity-100"
          strokeWidth={1.75}
          aria-hidden
        />
      </div>
    </Link>
  );

  if (!animated) return content;

  return (
    <motion.div variants={fadeRise} initial="initial" animate="animate">
      {content}
    </motion.div>
  );
}
