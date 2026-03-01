"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

// 遮罩使用「旧主题」颜色，收缩时露出下方已切换的「新主题」内容
const THEME_BG = {
  light: "#f5f3f0",
  dark: "#0f1216",
};

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [leavingTheme, setLeavingTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme") as Theme | null;
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const initial = stored ?? (prefersDark ? "dark" : "light");
    setThemeState(initial);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  const setTheme = useCallback(
    (t: Theme) => {
      if (t === theme) return;
      setLeavingTheme(theme); // 记录要离开的主题（遮罩颜色）
      setThemeState(t); // 立即应用新主题
      setIsTransitioning(true);
    },
    [theme]
  );

  const toggleTheme = useCallback(() => {
    const target = theme === "light" ? "dark" : "light";
    setLeavingTheme(theme);
    setThemeState(target);
    setIsTransitioning(true);
  }, [theme]);

  const handleTransitionEnd = useCallback(() => {
    setLeavingTheme(null);
    setIsTransitioning(false);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}

      {/* 遮罩：旧主题色从左下角收缩，露出下方已切换的新主题内容 */}
      <AnimatePresence>
        {isTransitioning && leavingTheme !== null && (
          <motion.div
            key="theme-transition"
            initial={{
              clipPath: "circle(150% at 0% 100%)",
            }}
            animate={{
              clipPath: "circle(0% at 0% 100%)",
              transition: {
                duration: 0.7,
                ease: [0.25, 0.46, 0.45, 0.94],
              },
            }}
            exit={{
              clipPath: "circle(0% at 0% 100%)",
            }}
            onAnimationComplete={handleTransitionEnd}
            className="fixed inset-0 z-[9999] pointer-events-none"
            style={{
              backgroundColor: THEME_BG[leavingTheme],
            }}
          />
        )}
      </AnimatePresence>
    </ThemeContext.Provider>
  );
}
