"use client";

import { motion } from "framer-motion";

interface Props {
  lit: boolean;
  onClickArea: () => void;
  disabled?: boolean;
}

const LIGHT_COUNT = 5;
const ACCENT = "#84cc16"; // lime
const RED = "#ef4444";

export function LightStrip({ lit, onClickArea, disabled = false }: Props) {
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onClickArea(); }}
      disabled={disabled}
      aria-label={lit ? "Wait for lights to extinguish" : "Click as fast as you can"}
      className={[
        "relative w-full select-none rounded-2xl border-2 px-4 py-10 md:py-14",
        "transition-colors duration-200",
        disabled
          ? "cursor-default border-[var(--pixel-border)] bg-[var(--pixel-card-bg)]"
          : lit
            ? "cursor-pointer border-[#ef4444] bg-[color-mix(in_oklab,#ef4444_8%,var(--pixel-card-bg))]"
            : "cursor-pointer border-[#84cc16] bg-[color-mix(in_oklab,#84cc16_10%,var(--pixel-card-bg))]",
        "shadow-xl shadow-[var(--pixel-glow)]",
      ].join(" ")}
      style={{
        boxShadow: lit
          ? "0 0 40px 0 rgba(239,68,68,0.35), 0 0 0 1px rgba(239,68,68,0.4) inset"
          : disabled
            ? undefined
            : "0 0 40px 0 rgba(132,204,22,0.25), 0 0 0 1px rgba(132,204,22,0.3) inset",
      }}
    >
      <div className="flex items-center justify-center gap-3 md:gap-5">
        {Array.from({ length: LIGHT_COUNT }).map((_, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={{
              scale: lit ? 1 : 0.85,
              opacity: lit ? 1 : 0.25,
            }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 22,
              delay: lit ? i * 0.05 : 0, // light up sequentially
            }}
            className={[
              "h-10 w-10 md:h-14 md:w-14 lg:h-16 lg:w-16 rounded-full border-2",
              lit
                ? "border-red-300/60"
                : "border-[var(--pixel-border)]",
            ].join(" ")}
            style={{
              background: lit ? RED : "transparent",
              boxShadow: lit
                ? `0 0 24px 4px ${RED}, inset 0 0 12px 2px rgba(255,255,255,0.25)`
                : "none",
            }}
            aria-hidden
          />
        ))}
      </div>

      {/* GO! signal text overlay */}
      {!lit && !disabled && (
        <motion.div
          key="go-signal"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 480, damping: 22 }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span
            className="font-sans text-3xl md:text-5xl font-bold tracking-tight"
            style={{ color: ACCENT, textShadow: `0 0 20px ${ACCENT}` }}
          >
            GO!
          </span>
        </motion.div>
      )}
    </button>
  );
}
