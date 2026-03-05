"use client";

import ThemeProvider from "@/app/components/ThemeProvider";
import ThemeToggle from "@/app/components/ThemeToggle";
import { ReactNode } from "react";

export default function ThemeShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ThemeToggle />
      {children}
    </ThemeProvider>
  );
}
