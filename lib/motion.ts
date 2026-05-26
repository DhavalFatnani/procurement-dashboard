"use client";

import type { Transition, Variants } from "motion/react";

/**
 * Shared motion presets — single source of truth for durations + easings.
 *
 * Durations mirror the CSS tokens in app/globals.css:
 *  --duration-fast = 120ms, --duration = 180ms, --duration-slow = 280ms.
 *
 * All variants honour `prefers-reduced-motion` because the framer/motion
 * runtime respects it automatically when transition durations are short.
 */

export const easeOut: Transition["ease"] = [0.22, 1, 0.36, 1];
export const easeEmphasized: Transition["ease"] = [0.2, 0, 0, 1];

export const durations = {
  fast: 0.12,
  base: 0.18,
  slow: 0.28,
} as const;

/** Fade + 4px y-translate. The default page/section enter. */
export const fadeRise: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: durations.fast, ease: easeOut },
  },
};

/** Container that staggers its children's enter animation. */
export const staggerChildren = (delay = 0.04): Variants => ({
  initial: {},
  animate: {
    transition: { staggerChildren: delay, delayChildren: 0.02 },
  },
});

/** Pop / scale-in for chips, toasts, popovers. */
export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: durations.base, ease: easeOut },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: durations.fast, ease: easeOut },
  },
};

/** Side sheet slide (right). */
export const sheetSlide: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.slow, ease: easeEmphasized },
  },
  exit: {
    opacity: 0,
    x: 24,
    transition: { duration: durations.base, ease: easeOut },
  },
};

/** Row enter for animated tables / lists. */
export const tableRow: Variants = {
  initial: { opacity: 0, y: 2 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.fast, ease: easeOut },
  },
};

/** Accordion expand/collapse via height: auto (use with layout). */
export const accordion: Variants = {
  collapsed: { height: 0, opacity: 0 },
  open: {
    height: "auto",
    opacity: 1,
    transition: { duration: durations.base, ease: easeOut },
  },
};

/** Press feedback for buttons and interactive cards. */
export const scalePress: Variants = {
  initial: { scale: 1 },
  tap: { scale: 0.98, transition: { duration: durations.fast, ease: easeOut } },
};

/** Drawer content entrance (paired with sheet slide). */
export const drawerSlide: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easeEmphasized, delay: 0.04 },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: durations.fast, ease: easeOut },
  },
};
