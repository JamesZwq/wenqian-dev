"use client";

import ThemeProvider from "@/app/components/ThemeProvider";
import { ReactNode } from "react";

export default function ThemeShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
