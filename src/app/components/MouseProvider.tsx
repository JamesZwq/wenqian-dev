"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { useMotionValue, useSpring, type MotionValue } from "framer-motion";

type MouseContextValue = {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  smoothX: MotionValue<number>;
  smoothY: MotionValue<number>;
};

const MouseContext = createContext<MouseContextValue | null>(null);

export function useMouse(): MouseContextValue {
  const ctx = useContext(MouseContext);
  if (!ctx) throw new Error("useMouse must be used within MouseProvider");
  return ctx;
}

export default function MouseProvider({ children }: { children: React.ReactNode }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 150 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set((clientX / innerWidth) * 2 - 1);
      mouseY.set((clientY / innerHeight) * 2 - 1);
    },
    [mouseX, mouseY]
  );

  const value = useMemo(
    () => ({ mouseX, mouseY, smoothX, smoothY }) as MouseContextValue,
    [mouseX, mouseY, smoothX, smoothY]
  );

  return (
    <MouseContext.Provider value={value}>
      <div onMouseMove={handleMouseMove} className="min-h-screen">
        {children}
      </div>
    </MouseContext.Provider>
  );
}
