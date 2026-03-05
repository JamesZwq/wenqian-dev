"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

type Theme = "light" | "dark";
type ThemeSetting = "system" | Theme;

const ThemeContext = createContext<{
  theme: Theme; // effective theme being applied
  setting: ThemeSetting; // user selection (system / light / dark)
  setSetting: (setting: ThemeSetting) => void;
  cycleSetting: () => void;
  setTheme: (theme: Theme) => void; // convenience: sets explicit theme (exits system mode)
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
  const [setting, setSetting] = useState<ThemeSetting>("system");
  const [systemTheme, setSystemTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Read stored preference + current system preference
  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem("theme-setting") as ThemeSetting | null) ?? "system";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const initialSystem = media.matches ? "dark" : "light";
    setSystemTheme(initialSystem);
    setSetting(stored);

    const handler = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const effectiveTheme: Theme = setting === "system" ? systemTheme : setting;

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.dataset.theme = effectiveTheme;
    root.classList.toggle("dark", effectiveTheme === "dark");
    root.style.colorScheme = effectiveTheme;
    localStorage.setItem("theme-setting", setting);
  }, [effectiveTheme, setting, mounted]);

  const setTheme = useCallback((t: Theme) => {
    setSetting(t);
  }, []);

  const cycleSetting = useCallback(() => {
    setSetting((prev) => {
      if (prev === "system") return systemTheme === "dark" ? "light" : "dark";
      if (prev === "light") return "dark";
      return "system";
    });
  }, [systemTheme]);

  const value = useMemo(
    () => ({ theme: effectiveTheme, setting, setSetting, cycleSetting, setTheme }),
    [effectiveTheme, setting, setTheme, cycleSetting]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
