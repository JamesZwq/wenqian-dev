"use client";

import { motion } from "framer-motion";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileHover={{
        scale: 1.04,
        boxShadow: "0 0 14px rgba(255,255,255,0.25)",
      }}
      whileTap={{ scale: 0.97 }}
      className="pointer-events-auto fixed top-4 right-4 z-[140] flex items-center gap-2 px-2 py-1 rounded-[6px] border border-[color-mix(in_oklab,var(--pixel-border)_90%,black)] bg-[color-mix(in_oklab,var(--pixel-bg)_80%,transparent)] shadow-[0_0_0_1px_rgba(0,0,0,0.8)]"
    >
      {/* 文本标签 */}
      <motion.span
        className="font-[family-name:var(--font-press-start)] text-[8px] tracking-[0.16em] text-[color-mix(in_oklab,var(--pixel-text)_85%,transparent)]"
        animate={{ opacity: isDark ? 0.9 : 0.9 }}
      >
        {isDark ? "NIGHT" : "DAY"}
      </motion.span>

      {/* 开关主体：像素风小胶囊，内部有太阳/月亮 + 星星动画 */}
      <motion.div
        className="relative w-14 h-7 rounded-full border border-[color-mix(in_oklab,var(--pixel-border)_90%,black)] overflow-hidden"
        animate={{
          background: isDark
            ? "radial-gradient(circle at 20% 0%, rgba(56,189,248,0.45), transparent 55%), radial-gradient(circle at 80% 100%, rgba(34,197,94,0.45), transparent 55%), #020617"
            : "radial-gradient(circle at 20% 0%, rgba(253,224,71,0.55), transparent 55%), radial-gradient(circle at 80% 100%, rgba(96,165,250,0.45), transparent 55%), #e5e7eb",
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
          className="absolute top-1 left-1 w-5 h-5 rounded-full border border-[color-mix(in_oklab,var(--pixel-border)_95%,black)] shadow-[0_0_8px_rgba(0,0,0,0.5)]"
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
          {/* 月亮凹口 / 太阳光芒 */}
          {isDark ? (
            <>
              {/* 月牙凹口 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[color-mix(in_oklab,var(--pixel-bg)_92%,black)] translate-x-[3px] opacity-90" />
              </div>
            </>
          ) : (
            <>
              {/* 太阳光芒 */}
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
