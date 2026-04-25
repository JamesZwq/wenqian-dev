"use client";

import { motion } from "framer-motion";

interface Props {
  /** Number of lights currently lit (0..5). 5 = all on; 0 = all off (could be "GO" or "idle"). */
  litCount: number;
  /** When true, treat the all-off state as the GO signal (show "GO!" text + green border). */
  isGoSignal: boolean;
  onClickArea: () => void;
  disabled?: boolean;
}

const LIGHT_COUNT = 5;
const RED = "#ef4444";
const GREEN = "#84cc16";

export function LightStrip({ litCount, isGoSignal, onClickArea, disabled = false }: Props) {
  const anyLit = litCount > 0;

  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onClickArea(); }}
      disabled={disabled}
      aria-label={isGoSignal ? "Click as fast as you can" : "Wait for lights to extinguish"}
      className={[
        "relative w-full select-none rounded-2xl border-2 px-4 py-10 md:py-14",
        "transition-colors duration-150",
        disabled
          ? "cursor-default border-[var(--pixel-border)] bg-[var(--pixel-card-bg)]"
          : isGoSignal
            ? "cursor-pointer border-[#84cc16] bg-[color-mix(in_oklab,#84cc16_10%,var(--pixel-card-bg))]"
            : anyLit
              ? "cursor-pointer border-[#ef4444] bg-[color-mix(in_oklab,#ef4444_8%,var(--pixel-card-bg))]"
              : "cursor-pointer border-[var(--pixel-border)] bg-[var(--pixel-card-bg)]",
        "shadow-xl shadow-[var(--pixel-glow)]",
      ].join(" ")}
      style={{
        boxShadow: isGoSignal
          ? "0 0 50px 0 rgba(132,204,22,0.45), 0 0 0 1px rgba(132,204,22,0.5) inset"
          : anyLit
            ? "0 0 40px 0 rgba(239,68,68,0.35), 0 0 0 1px rgba(239,68,68,0.4) inset"
            : undefined,
      }}
    >
      <div className="flex items-center justify-center gap-3 md:gap-5">
        {Array.from({ length: LIGHT_COUNT }).map((_, i) => {
          const isOn = i < litCount;
          return (
            <motion.div
              key={i}
              initial={false}
              animate={{
                scale: isOn ? 1 : 0.85,
                opacity: isOn ? 1 : 0.22,
              }}
              transition={{ duration: 0.08, ease: "easeOut" }}
              className={[
                "h-10 w-10 md:h-14 md:w-14 lg:h-16 lg:w-16 rounded-full border-2",
                isOn ? "border-red-300/60" : "border-[var(--pixel-border)]",
              ].join(" ")}
              style={{
                background: isOn ? RED : "transparent",
                boxShadow: isOn
                  ? `0 0 24px 4px ${RED}, inset 0 0 12px 2px rgba(255,255,255,0.25)`
                  : "none",
              }}
              aria-hidden
            />
          );
        })}
      </div>

      {/* GO! signal text overlay */}
      {isGoSignal && (
        <motion.div
          key="go-signal"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span
            className="font-sans text-3xl md:text-5xl font-bold tracking-tight"
            style={{ color: GREEN, textShadow: `0 0 20px ${GREEN}` }}
          >
            GO!
          </span>
        </motion.div>
      )}
    </button>
  );
}
