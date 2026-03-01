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
      className="font-[family-name:var(--font-press-start)] text-[10px] px-3 py-2 border-2 border-[#00ff88] bg-[#0a0a0b] text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
      style={{ boxShadow: "0 0 10px rgba(0,255,136,0.2)" }}
    >
      [ {isDark ? "DARK" : "LITE"} ]
    </motion.button>
  );
}
