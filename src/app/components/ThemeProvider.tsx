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

      {/* 柔和淡入淡出遮罩，减轻亮度跳变带来的刺眼感 */}
      <AnimatePresence>
        {isTransitioning && leavingTheme !== null && (
          <motion.div
            key="theme-transition"
            initial={{ opacity: 0.5 }}
            animate={{
              opacity: 0,
              transition: {
                duration: 0.6,
                ease: [0.25, 0.46, 0.45, 0.94],
              },
            }}
            exit={{ opacity: 0 }}
            onAnimationComplete={handleTransitionEnd}
            className="fixed inset-0 z-[9999] pointer-events-none"
            style={{
              backgroundColor: theme === "light" ? "#f5f3f0" : "#050608",
            }}
          />
        )}
      </AnimatePresence>
    </ThemeContext.Provider>
  );
}
