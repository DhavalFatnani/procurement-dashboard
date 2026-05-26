"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { fadeRise, staggerChildren } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function AnimatedGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(className)}
      variants={staggerChildren(0.06)}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedGridItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={fadeRise}>
      {children}
    </motion.div>
  );
}
