import type { Variants } from "framer-motion";

/** Base ease curve and durations matched to existing pages (poker, halli-galli). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const ENTRY_DURATION = 0.3;
export const EXIT_DURATION = 0.15;

/** Card / dialog entry: subtle rise + fade. */
export const cardEntry: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: ENTRY_DURATION, ease: EASE_OUT } },
  exit:    { opacity: 0, y: 8,  transition: { duration: EXIT_DURATION,  ease: EASE_OUT } },
};

/** Dropdown menu (used by UserWidget); mirrors FloatingNav's pattern. */
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: -8 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { duration: 0.18, ease: EASE_OUT, staggerChildren: 0.04 },
  },
  exit:    { opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12 } },
};

export const dropdownItemVariants: Variants = {
  hidden:  { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0 },
};
