"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import * as React from "react";

import { fadeRise } from "@/lib/motion";

/**
 * Fades + slides 4px on route change inside the dashboard.
 *
 * Honoured by motion's reduced-motion handling — the transition collapses to
 * an immediate snap when `prefers-reduced-motion` is set.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={pathname}
        variants={fadeRise}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
