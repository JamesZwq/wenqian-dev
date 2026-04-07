"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const menuItems = [
  { href: "/chat", label: "P2P Chat", icon: "💬", color: "var(--pixel-warn)", description: "Encrypted peer-to-peer messaging" },
  { href: "/gomoku", label: "Gomoku", icon: "⚫", color: "var(--pixel-accent)", description: "Five in a Row multiplayer game" },
  { href: "/maze", label: "Maze Runner", icon: "🏃", color: "var(--pixel-accent-2)", description: "P2P maze race with items & power-ups" },
  { href: "/math", label: "Math Sprint", icon: "🧮", color: "var(--pixel-accent)", description: "Speed arithmetic challenge" },
  { href: "/flash-count", label: "Flash Count", icon: "🧊", color: "var(--pixel-accent-2)", description: "Count 3D blocks before they vanish" },
  { href: "/poker", label: "Texas Hold'em", icon: "♠️", color: "var(--pixel-warn)", description: "Heads-up P2P poker, blinds escalate" },
  { href: "/sudoku", label: "Sudoku", icon: "🔢", color: "var(--pixel-accent)", description: "Solo or P2P race — same puzzle, fastest wins" },
  { href: "/halli-galli", label: "Halli Galli", icon: "🔔", color: "var(--pixel-warn)", description: "Ring the bell when any fruit totals exactly 5!" },
];

/* -- Framer Motion variants for staggered children -- */
const dropdownVariants = {
  hidden: { opacity: 0, scale: 0.92, y: -8 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 28, staggerChildren: 0.04, delayChildren: 0.06 },
  },
  exit: {
    opacity: 0, scale: 0.92, y: -8,
    transition: { duration: 0.18, ease: "easeIn" as const },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12, filter: "blur(4px)" },
  visible: { opacity: 1, x: 0, filter: "blur(0px)", transition: { type: "spring" as const, stiffness: 380, damping: 24 } },
  exit: { opacity: 0, x: -8, transition: { duration: 0.12 } },
};

export default function FloatingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <div className="fixed top-6 left-6 z-50">
      {/* Main button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 rounded-xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] px-4 py-3 font-sans text-sm font-semibold tracking-tight text-[var(--pixel-accent)] shadow-xl shadow-[var(--pixel-glow)] backdrop-blur-sm transition-shadow hover:shadow-2xl"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
      >
        <motion.span
          className="text-base inline-flex items-center justify-center leading-none -translate-y-px"
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {isOpen ? "✕" : "☰"}
        </motion.span>
        <span className="hidden sm:inline">MENU</span>
      </motion.button>

      {/* Backdrop overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 -z-10 bg-black/20 backdrop-blur-[2px]"
            onClick={close}
          />
        )}
      </AnimatePresence>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute left-0 top-full mt-3 w-80 max-h-[calc(100dvh-100px)] flex flex-col rounded-2xl border border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] shadow-2xl shadow-[var(--pixel-glow)] backdrop-blur-md will-change-transform"
          >
            {/* Header */}
            <div className="shrink-0 border-b border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-3 rounded-t-2xl">
              <h3 className="font-sans text-sm font-semibold tracking-tight text-[var(--pixel-accent)]">
                P2P Applications
              </h3>
            </div>

            {/* Scrollable items */}
            <div className="overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin] [scrollbar-color:var(--pixel-accent)_transparent]">
              {menuItems.map((item) => (
                <motion.div key={item.href} variants={itemVariants}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className="group relative block rounded-xl border border-transparent p-3.5 transition-colors duration-150 hover:border-[var(--pixel-border)] hover:bg-[var(--pixel-bg-alt)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl transition-transform duration-200 group-hover:scale-110">
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="mb-0.5 font-sans text-sm font-semibold tracking-tight" style={{ color: item.color }}>
                          {item.label}
                        </div>
                        <div className="font-mono text-xs text-[var(--pixel-muted)]">
                          {item.description}
                        </div>
                      </div>
                      <span className="text-[var(--pixel-accent)] opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] px-4 py-2 rounded-b-2xl">
              <p className="font-mono text-[10px] text-[var(--pixel-muted)]">
                &gt; Browser-to-browser, no server required
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
