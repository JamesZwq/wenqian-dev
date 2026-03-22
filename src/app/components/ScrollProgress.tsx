"use client";

import { motion, useSpring, useMotionValue } from "framer-motion";
import { useScrollLag } from "./ScrollLagContext";

export default function ScrollProgress() {
  const scrollLag = useScrollLag();
  const zeroProgress = useMotionValue(0);
  const scrollYProgress = scrollLag?.scrollYProgress ?? zeroProgress;
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-[var(--pixel-accent)] origin-left z-[100] rounded-r-full"
      style={{ scaleX, boxShadow: "0 0 10px var(--pixel-glow)" }}
    />
  );
}
