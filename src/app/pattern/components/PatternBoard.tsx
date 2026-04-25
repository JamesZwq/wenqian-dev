"use client";

import { motion } from "framer-motion";
import { COLOR_HEX, COLORS, type Color } from "../types";

interface Props {
  activeColor: Color | null;
  onColorClick: (c: Color) => void;
  disabled?: boolean;
}

// Quadrant positions in a 2x2 grid (top-left, top-right, bottom-left, bottom-right)
const QUADRANT_LABEL: Record<Color, string> = {
  red: "Top left",
  green: "Top right",
  blue: "Bottom left",
  yellow: "Bottom right",
};

export function PatternBoard({ activeColor, onColorClick, disabled = false }: Props) {
  return (
    <div
      className={[
        "grid grid-cols-2 gap-2 md:gap-3",
        "rounded-2xl border-2 border-[color-mix(in_oklab,var(--pixel-accent)_50%,transparent)]",
        "p-3 md:p-4",
        "bg-[color-mix(in_oklab,var(--pixel-accent)_8%,var(--pixel-bg))]",
        "shadow-lg shadow-[var(--pixel-glow)]",
      ].join(" ")}
    >
      {COLORS.map((color) => {
        const isActive = activeColor === color;
        const hex = COLOR_HEX[color];

        return (
          <motion.button
            key={color}
            onClick={() => !disabled && onColorClick(color)}
            disabled={disabled}
            aria-label={`${QUADRANT_LABEL[color]} — ${color}`}
            animate={{
              scale: isActive ? 1.05 : 1,
              filter: isActive ? "brightness(1.6) saturate(1.3)" : "brightness(0.55) saturate(0.85)",
              boxShadow: isActive
                ? `0 0 40px 6px ${hex}, 0 0 80px 12px ${hex}88, inset 0 0 30px ${hex}66`
                : `0 0 0 0 ${hex}00`,
            }}
            transition={{
              scale: { type: "spring", stiffness: 400, damping: 24 },
              filter: { duration: 0.12 },
              boxShadow: { duration: 0.12 },
            }}
            whileHover={!disabled && !isActive ? { filter: "brightness(0.75) saturate(1.0)" } : undefined}
            whileTap={!disabled ? { scale: 0.96, filter: "brightness(1.6) saturate(1.3)" } : undefined}
            style={{ backgroundColor: hex }}
            className={[
              "relative",
              "w-32 h-32 md:w-44 md:h-44 lg:w-52 lg:h-52",
              "rounded-2xl border-2 border-[var(--pixel-border)]",
              "flex items-center justify-center select-none",
              disabled ? "cursor-default" : "cursor-pointer",
              "outline-none focus-visible:ring-2 focus-visible:ring-[var(--pixel-accent)]",
            ].join(" ")}
          >
            {/* Subtle inner ring when active */}
            <motion.span
              aria-hidden
              className="absolute inset-2 rounded-xl pointer-events-none"
              animate={{
                opacity: isActive ? 1 : 0,
                borderColor: hex,
              }}
              transition={{ duration: 0.1 }}
              style={{
                border: `2px solid ${hex}`,
                boxShadow: `inset 0 0 20px ${hex}`,
              }}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
