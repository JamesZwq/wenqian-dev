"use client";

import { motion } from "framer-motion";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, setting, cycleSetting } = useTheme();
  const isDark = theme === "dark";
  const label = setting === "system" ? "AUTO" : isDark ? "NIGHT" : "DAY";

  return (
    <motion.button
      type="button"
      onClick={cycleSetting}
      whileHover={{
        scale: 1.04,
        boxShadow: "0 0 14px rgba(99,102,241,0.25)",
      }}
      whileTap={{ scale: 0.97 }}
      className="pointer-events-auto fixed top-4 right-4 z-[140] flex items-center gap-2 px-2 py-1 rounded-xl border border-[color-mix(in_oklab,var(--pixel-border)_90%,transparent)] bg-[color-mix(in_oklab,var(--pixel-bg)_80%,transparent)] shadow-lg backdrop-blur-sm"
    >
      {/* 文本标签 */}
      <motion.span
        className="font-sans text-[10px] font-semibold tracking-tight text-[color-mix(in_oklab,var(--pixel-text)_85%,transparent)]"
        animate={{ opacity: isDark ? 0.9 : 0.9 }}
      >
        {label}
      </motion.span>

      {/* 开关主体 */}
      <motion.div
        className="relative w-14 h-7 rounded-full border border-[color-mix(in_oklab,var(--pixel-border)_90%,transparent)] overflow-hidden"
        animate={{
          background: isDark
            ? "radial-gradient(circle at 20% 0%, rgba(129,140,248,0.45), transparent 55%), radial-gradient(circle at 80% 100%, rgba(167,139,250,0.45), transparent 55%), #0c0a1d"
            : "radial-gradient(circle at 20% 0%, rgba(253,224,71,0.55), transparent 55%), radial-gradient(circle at 80% 100%, rgba(99,102,241,0.45), transparent 55%), #e5e7eb",
        }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* 轨道内侧高光 */}
        <motion.div
          className="absolute inset-[1px] rounded-full"
          animate={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.15), rgba(0,0,0,0.12))",
            opacity: isDark ? 0.25 : 0.4,
          }}
          transition={{ duration: 0.5 }}
        />

        {/* 星星（仅在夜晚出现） */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{ opacity: isDark ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="absolute left-[4px] top-[3px] w-[2px] h-[2px] rounded-full bg-[color-mix(in_oklab,var(--pixel-accent-2)_90%,white)] opacity-90" />
          <span className="absolute left-[10px] top-[1px] w-[1px] h-[1px] rounded-full bg-[color-mix(in_oklab,var(--pixel-accent-2)_85%,white)] opacity-80" />
          <span className="absolute right-[4px] bottom-[3px] w-[2px] h-[2px] rounded-full bg-[color-mix(in_oklab,var(--pixel-accent)_90%,white)] opacity-90" />
        </motion.div>

        {/* 太阳 / 月亮滑块 */}
        <motion.div
          className="absolute top-1 left-1 w-5 h-5 rounded-full border border-[color-mix(in_oklab,var(--pixel-border)_95%,transparent)] shadow-lg"
          layout
          animate={{
            x: isDark ? 26 : 0,
            backgroundColor: isDark
              ? "color-mix(in_oklab,var(--pixel-accent-2)_85%,black)"
              : "color-mix(in_oklab,var(--pixel-accent)_90%,white)",
          }}
          transition={{
            type: "spring",
            stiffness: 480,
            damping: 32,
          }}
        >
          {isDark ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[color-mix(in_oklab,var(--pixel-bg)_92%,black)] translate-x-[3px] opacity-90" />
              </div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[11px] h-[11px] rounded-full bg-[color-mix(in_oklab,#facc15_90%,white)] shadow-[0_0_6px_rgba(250,204,21,0.9)]" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[1px] h-[6px] bg-[color-mix(in_oklab,#facc15_90%,white)] translate-y-[-5px]" />
                <div className="w-[1px] h-[6px] bg-[color-mix(in_oklab,#facc15_90%,white)] translate-y-[5px]" />
                <div className="w-[6px] h-[1px] bg-[color-mix(in_oklab,#facc15_90%,white)] translate-x-[-5px]" />
                <div className="w-[6px] h-[1px] bg-[color-mix(in_oklab,#facc15_90%,white)] translate-x-[5px]" />
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </motion.button>
  );
}
