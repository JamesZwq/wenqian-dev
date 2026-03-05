"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";

const SCROLL_SPRING = { stiffness: 280, damping: 32 };
const LAG_STRENGTH = 0.12;

export type ScrollLagValue = {
  lagX: MotionValue<number>;
  lagY: MotionValue<number>;
  scrollYProgress: MotionValue<number>;
};

const ScrollLagContext = createContext<ScrollLagValue | null>(null);

export function useScrollLag(): ScrollLagValue | null {
  return useContext(ScrollLagContext);
}

export function ScrollLagProvider({ children }: { children: React.ReactNode }) {
  const { scrollY, scrollX, scrollYProgress } = useScroll();
  const smoothY = useSpring(scrollY, SCROLL_SPRING);
  const smoothX = useSpring(scrollX, SCROLL_SPRING);
  const lagY = useTransform(
    [scrollY, smoothY],
    ([sy, ssy]) => ((sy as number) - (ssy as number)) * LAG_STRENGTH
  );
  const lagX = useTransform(
    [scrollX, smoothX],
    ([sx, ssx]) => ((sx as number) - (ssx as number)) * LAG_STRENGTH
  );

  const value = useMemo<ScrollLagValue>(
    () => ({ lagX, lagY, scrollYProgress }),
    [lagX, lagY, scrollYProgress]
  );

  return (
    <ScrollLagContext.Provider value={value}>
      {children}
    </ScrollLagContext.Provider>
  );
}
