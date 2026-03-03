"use client";

import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center font-[family-name:var(--font-press-start)] text-[10px] px-3 py-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-bg-alt)] text-[var(--pixel-accent)] hover:bg-[color-mix(in_oklab,var(--pixel-accent)_12%,var(--pixel-bg-alt))] transition-colors touch-manipulation"
      style={{ boxShadow: "0 0 10px var(--pixel-glow)" }}
    >
      [ {isDark ? "DARK" : "LITE"} ]
    </motion.button>
  );
}
