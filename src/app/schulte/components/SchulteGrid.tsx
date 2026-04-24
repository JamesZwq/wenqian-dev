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
};

const CELL_SIZE: Record<GridSize, string> = {
  3: "w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28",
  4: "w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24",
  5: "w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20",
};

const FONT_SIZE: Record<GridSize, string> = {
  3: "text-3xl md:text-4xl lg:text-5xl",
  4: "text-2xl md:text-3xl lg:text-4xl",
  5: "text-lg md:text-2xl lg:text-3xl",
};

export function SchulteGrid({ numbers, size, currentTarget, wrongClickIndex, onCellClick, disabled = false }: Props) {
  if (numbers.length === 0) return null;

  return (
    <div
      className={[
        "grid",
        GRID_COLS[size],
        "gap-1.5 md:gap-2",
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
              "rounded-lg border font-mono font-bold",
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
                  {n}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
