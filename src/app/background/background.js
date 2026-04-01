"use client";

import "./styles.css";
import { Suspense } from "react";
import { Scene } from "./Scene";
import { useTheme } from "../components/ThemeProvider";

export default function Background() {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 z-0">
      <div className="w-screen h-screen">
        <Suspense fallback={null}>
          <Scene theme={theme} />
        </Suspense>
      </div>
    </div>
  );
}
