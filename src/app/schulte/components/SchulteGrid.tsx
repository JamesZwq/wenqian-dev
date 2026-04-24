"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GridSize } from "../types";

interface Props {
  numbers: number[];
  size: GridSize;
  currentTarget: number;
  wrongClickIndex: number | null;
  onCellClick: (index: number) => void;
  disabled?: boolean;
}

// Tailwind-safe grid column classes (these literal strings must exist so the JIT keeps them)
const GRID_COLS: Record<GridSize, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
};

const CELL_SIZE: Record<GridSize, string> = {
  3: "w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28",
  4: "w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24",
  5: "w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20",
  6: "w-11 h-11 md:w-14 md:h-14 lg:w-16 lg:h-16",
  7: "w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14",
  8: "w-9 h-9 md:w-11 md:h-11 lg:w-12 lg:h-12",
  9: "w-8 h-8 md:w-10 md:h-10 lg:w-11 lg:h-11",
  10: "w-7 h-7 md:w-9 md:h-9 lg:w-10 lg:h-10",
};

const FONT_SIZE: Record<GridSize, string> = {
  3: "text-3xl md:text-4xl lg:text-5xl",
  4: "text-2xl md:text-3xl lg:text-4xl",
  5: "text-lg md:text-2xl lg:text-3xl",
  6: "text-base md:text-xl lg:text-2xl",
  7: "text-sm md:text-lg lg:text-xl",
  8: "text-xs md:text-base lg:text-lg",
  9: "text-[10px] md:text-sm lg:text-base",
  10: "text-[9px] md:text-xs lg:text-sm",
};

const GAP_SIZE: Record<GridSize, string> = {
  3: "gap-1.5 md:gap-2",
  4: "gap-1.5 md:gap-2",
  5: "gap-1.5 md:gap-2",
  6: "gap-1 md:gap-1.5",
  7: "gap-1 md:gap-1.5",
  8: "gap-1 md:gap-1",
  9: "gap-0.5 md:gap-1",
  10: "gap-0.5 md:gap-1",
};

export function SchulteGrid({ numbers, size, currentTarget, wrongClickIndex, onCellClick, disabled = false }: Props) {
  if (numbers.length === 0) return null;

  // Pad numbers to at least 2 digits (e.g., "01" instead of "1"),
  // or match the max number's digit count (for 10×10 where max = 100 → 3 digits)
  const maxN = size * size;
  const padWidth = Math.max(2, String(maxN).length);
  const fmt = (n: number) => String(n).padStart(padWidth, "0");

  return (
    <div
      className={[
        "grid",
        GRID_COLS[size],
        GAP_SIZE[size],
        "rounded-xl border-2 border-[color-mix(in_oklab,var(--pixel-accent)_50%,transparent)]",
        "p-2 md:p-3",
        "bg-[color-mix(in_oklab,var(--pixel-accent)_8%,var(--pixel-bg))]",
        "shadow-lg shadow-[var(--pixel-glow)]",
      ].join(" ")}
    >
      {numbers.map((n, i) => {
        const isCleared = n < currentTarget;
        const isWrong = wrongClickIndex === i;

        return (
          <motion.button
            key={i}
            onClick={() => !disabled && !isCleared && onCellClick(i)}
            disabled={disabled || isCleared}
            animate={
              isWrong
                ? { scale: [1, 1.08, 1], backgroundColor: "var(--pixel-warn)" }
                : { scale: 1 }
            }
            transition={
              isWrong
                ? { duration: 0.4, ease: "easeOut" }
                : { type: "spring", stiffness: 400, damping: 26 }
            }
            whileHover={!isCleared && !disabled ? { scale: 1.04 } : undefined}
            whileTap={!isCleared && !disabled ? { scale: 0.94 } : undefined}
            className={[
              CELL_SIZE[size],
              FONT_SIZE[size],
              "rounded-lg border font-mono font-bold tabular-nums",
              "flex items-center justify-center select-none",
              "transition-colors duration-150",
              isCleared
                ? "border-[var(--pixel-border)] bg-transparent text-transparent cursor-default"
                : isWrong
                  ? "border-[var(--pixel-warn)] text-white"
                  : "border-[var(--pixel-border)] bg-[var(--pixel-card-bg)] text-[var(--pixel-accent)] hover:border-[var(--pixel-accent)] hover:bg-[var(--pixel-bg-alt)] cursor-pointer",
            ].join(" ")}
            aria-label={`Tile ${n}`}
          >
            <AnimatePresence mode="wait">
              {!isCleared && (
                <motion.span
                  key={n}
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.25 }}
                >
                  {fmt(n)}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
